import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { immerable } from "immer"
import { useCallback } from "react"
import { Matrix4, Object3D, Quaternion, Vector2, Vector3, Vector4 } from "three"
import { useAppSelector, useAppStore } from "../hooks"

const pi2 = 2 * Math.PI

/**
 * Mark classes as copyable by immer, which also make the middleware treat them
 * as serializable.
 */
function markImmerable() {
  const mark = (constructor: any) => (constructor[immerable] = true)
  void [Quaternion, Vector2, Vector3, Vector4].map(mark)
}
markImmerable()

export type State = {
  border: {
    width: number
    coords: Coords
  }
  spacemap: {
    coords: Coords
    pixelsPerUnit: Vector2
    pixelsPerDegree: number
    pixelsPerScale: number
  }
  portal: {
    coords: Coords
    // geometry: Rect
  }
  viewer: {
    coords: Coords
    // geometry: Rect
  }
  viewport: {
    width: number
    height: number
  }
  drag: {
    start: {
      coords: Coords
      x: number
      y: number
    } | null
  }
}

/** Axis-aligned 2-d rectangle! */
export interface Rect {
  min: Vector2
  max: Vector2
}

export interface Coords {
  position: Vector3
  quaternion: Quaternion
  scale: Vector3
}

/**
 * The portal, viewer, and feedback geometries are 1x1 squares centered on the
 * origin. Therefore width and height are equal to scale!
 */
const initialState: State = {
  border: {
    width: 0.1,
    coords: {
      position: new Vector3(0, 0, -1),
      scale: new Vector3(1.2, 1.2, 1),
      quaternion: new Quaternion()
    }
  },
  spacemap: {
    coords: {
      position: new Vector3(0, 0.1, 0),
      scale: new Vector3(2, 2, 1),
      quaternion: new Quaternion()
    },
    /** Screen pixels per unit movement in position */
    pixelsPerUnit: new Vector2(-2e2, 2e2),
    /** Screen pixels per degree rotation (right-handed about z) */
    pixelsPerDegree: -5,
    /** Scroll wheel pixels per unit scaling */
    pixelsPerScale: 5e2
  },
  portal: {
    coords: {
      position: new Vector3(0, 0, 0),
      scale: new Vector3(1, 1, 1),
      quaternion: new Quaternion()
    }
  },
  viewer: {
    coords: {
      position: new Vector3(0, 0, 10),
      scale: new Vector3(1, 1, 1),
      quaternion: new Quaternion()
    }
  },
  viewport: {
    width: 0,
    height: 0
  },
  drag: { start: null }
}

export function createCoords(): Coords {
  return { position: new Vector3(), scale: new Vector3(), quaternion: new Quaternion() }
}
export function copyCoords(from: Coords, to: Coords = createCoords()): Coords {
  to.position.copy(from.position)
  to.quaternion.copy(from.quaternion)
  to.scale.copy(from.scale)
  return to
}

class Object3DCoords extends Object3D {
  from(coords: Coords) {
    copyCoords(coords, this)
    this.updateMatrixWorld()
    return this
  }

  to(coords: Coords) {
    copyCoords(this, coords)
  }
}

const o = new Object3DCoords()
const m = new Matrix4()

const slice = createSlice({
  name: "simulation",
  initialState,
  reducers: {
    setBorderWidth({ border, portal }, { payload: borderWidth }: PayloadAction<number>) {
      border.width = borderWidth
      border.coords.scale.set(
        portal.coords.scale.x + 2 * borderWidth,
        portal.coords.scale.y + 2 * borderWidth,
        1
      )
    },
    drag(
      { spacemap: { coords: spacemap }, viewport, viewer, drag },
      {
        payload: { x, y, end = false, start = false }
      }: PayloadAction<{ x: number; y: number; end?: boolean; start?: boolean }>
    ) {
      if (start || !drag.start) {
        drag.start = {
          coords: copyCoords(spacemap),
          x,
          y
        }
      }

      const dx = x - drag.start.x,
        dy = y - drag.start.y,
        dragStart = drag.start.coords

      const v = new Vector3(dx / viewport.width, -dy / viewport.height)
      o.from(viewer.coords).localToWorld(v)

      const s = o.from(dragStart)
      s.position.set(0, 0, 0)
      s.updateMatrixWorld()
      s.localToWorld(v)

      spacemap.position.x = dragStart.position.x - v.x
      spacemap.position.y = dragStart.position.y - v.y

      if (end) {
        drag.start = null
      }
    },
    rotate(
      { spacemap: { coords: spacemap }, viewport },
      { payload: { dx, dy } }: PayloadAction<{ dx: number; dy: number }>
    ) {
      const feedbackAngle = (dy / viewport.height) * pi2,
        portalAngle = (dx / viewport.width) * pi2
      o.from(spacemap)
        .rotateZ(portalAngle + feedbackAngle)
        .to(spacemap)
      spacemap.position.applyMatrix4(m.makeRotationZ(portalAngle))
    },
    zoom({ spacemap }, { payload: distance }: PayloadAction<number>) {
      const pps = spacemap.pixelsPerScale
      spacemap.coords.scale.x += distance / pps
      spacemap.coords.scale.y += distance / pps
    },
    setSize(
      { viewport, portal, viewer, border },
      { payload: { width, height } }: PayloadAction<{ width: number; height: number }>
    ) {
      const aspect = width / height,
        unitWidth = Math.sqrt(aspect),
        unitHeight = 1 / unitWidth

      viewport.width = width
      viewport.height = height
      portal.coords.scale.set(unitWidth, unitHeight, 1)
      border.coords.scale.set(unitWidth + 2 * border.width, unitHeight + 2 * border.width, 1)
      viewer.coords.scale.copy(portal.coords.scale)
    },
    reset(state) {
      state.portal = initialState.portal
      state.border = initialState.border
      state.spacemap = initialState.spacemap
      state.viewer = initialState.viewer
    }
  }
})

export const {
  reducer,
  actions: { setBorderWidth, rotate, zoom, setSize, drag, reset }
} = slice