var i_loop, feedbackTarget, TVMaterial, feedbackCamera, feedbackProcessor, 
    viewScene, viewCamera, symPass, colorPass, renderer, inputSettings;

function init() {
    window.touchOn = false;
    // #augh
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))touchOn = true})(navigator.userAgent||navigator.vendor||window.opera);

    ////////////
    // Canvas initalization
    ////////////

    // window.canvas   = document.getElementById("canvas");
    window.c_width  = window.innerWidth;
    window.c_height = window.innerHeight;
    window.aspect = c_width / c_height;

    ////////////
    // Constants
    ////////////

    // bounds on scaling in feedback loop
    window.minimumScaleFactor = 0.1;
    window.maximumScaleFactor = 3.0;

    // Number of parallel feedback loops. This allows us to increase the time
    // between renders but retain smooth movement.
    window.n_loops = 1;

    window.view_angle = 45;

    window.near = .1;
    window.far = 100; // TODO: set this by calculating max distance given scale factor range.

    // All render targets should be the same.
    var createRenderTarget = function () {
        return new THREE.WebGLRenderTarget(c_width, c_width, 
            {   minFilter       : THREE.LinearFilter,
                magFilter       : THREE.LinearFilter,
                format          : THREE.RGBFormat,
                generateMipmaps : false, /**/
                depthBuffer     : true,
                stencilBuffer   : false
             });
    }

    ////////////
    // Feedback scene setup
    ////////////

    /* 
     * The feedback scene consists of a TV, which is a quad that maps the 
     * previous render target, a border around the TV, and the viewCamera
     * overlay. The TV is centered on the origin and is aspect units in the
     * x direction and 1 unit in the y direction.
     */

    // The scene used in the feedback loop
    var feedbackScene = new THREE.Scene();

    // Initialize all render targets.
    feedbackTarget = new Array(n_loops);
    for (var i = 0; i < feedbackTarget.length; i++) {
        feedbackTarget[i] = createRenderTarget();
    }

    // Create the border, which consists of a solid colored border of some
    // thickness surrounded by a solid color background.
    // Set the background big enough so we never see the edges of it.
    var bgGeometry = new THREE.PlaneBufferGeometry(aspect / minimumScaleFactor * 5,
        1.0 / minimumScaleFactor * 5);
    bgMaterial = new THREE.MeshBasicMaterial({color : 0x70b2c5});
    var background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.position.set(0, 0, -1);

    // Create the border, which consists of a solid colored border of some
    // thickness surrounded by a solid color background.
    // window.borderProp = .1
    var borderGeometry = new THREE.PlaneBufferGeometry(aspect,// * (1.0 + 2 * borderProp),
        1.0);// * (1.0 + 2.0 * borderProp));
    borderMaterial = new THREE.MeshBasicMaterial({color : 0x000000});
    var border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.scale.set(1.05, 1 + 0.05 * aspect, 1);

    border.position.set(0, 0, -.5);

    // Create the TV. The textured mapped by the material is changed each
    // render cycle. Also, THREE.PlaneBufferGeometry is apparently a thing.
    var TVGeometry = new THREE.PlaneBufferGeometry(aspect, 1);
    TVMaterial     = new THREE.MeshBasicMaterial({map : feedbackTarget[0]});
    TV         = new THREE.Mesh(TVGeometry, TVMaterial);
    TV.position.set(0, 0, 0);

    // The renderer is set to render objects in the order in which they were
    // added to the scene, so the order we push matters.
    feedbackScene.add(TV);
    feedbackScene.add(border);
    feedbackScene.add(background);

    feedbackCamera = createScalableOrthoCam(aspect, minimumScaleFactor, maximumScaleFactor);
    feedbackCamera.setScale(.8); // initial relative size of TV
    feedbackCamera.position.z = 5; //.5 / Math.tan((view_angle / 2.0) * Math.PI / 180.0);
    feedbackScene.add(feedbackCamera);
    feedbackCamera.lookAt(new THREE.Vector3(0, 0, 0));

    ////////////
    // View scene (to be rendered to screen) setup
    ////////////

    viewScene = feedbackScene;
    viewCamera = createScalableOrthoCam(aspect, minimumScaleFactor, maximumScaleFactor);

    viewCamera.position.z = 5;
    viewScene.add(viewCamera);
    viewCamera.lookAt(new THREE.Vector3(0, 0, 0));

    /////////////
    // Renderer setup
    /////////////

    renderer = new THREE.WebGLRenderer( {
        antialias : false,
        stencil   : false,
        precision : "mediump",
        preserveDrawingBuffer:true} );

    if (!renderer) {
        document.getElementByType("body").innerHTML += "oh no webgl";
    }

    renderer.setSize(c_width, c_height);
    renderer.sortObjects = false;
    renderer.autoClearColor = false;

    var container = document.getElementById('container');

    container.appendChild(renderer.domElement)

    /////////////
    // Stats setup
    /////////////

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild(stats.domElement);


    /////////////
    // EffectComposer stack
    /////////////

    var renderPass = new THREE.RenderPass(feedbackScene, feedbackCamera);
    // renderPass.clearColor = new THREE.Color(0x70b2c5);

    symPass = new THREE.ShaderPass(SymmetryShader);
    colorPass = new THREE.ShaderPass(ColorShader);

    var RGBShiftPass = new THREE.ShaderPass( THREE.RGBShiftShader );

    // This will clone the render target, so it contains two buffers (for 
    // swap space).
    feedbackProcessor = new THREE.EffectComposer(renderer, createRenderTarget());

    feedbackProcessor.addPass(renderPass);
    feedbackProcessor.addPass(symPass);
    feedbackProcessor.addPass(colorPass);

    i_loop = 0;

    //////////////
    // variable control setup
    //////////////

    var getColorSetter = function(color) {
        return function(value) {
                  color.setHex(value.replace( '#','0x' ));
        }
    }

    var getUnifSetter = function(obj) {
        return function(value) {
            if (value)
                obj['value'] = 1;
            else
                obj['value'] = 0;
        }
    };

    window.gui = new dat.GUI();

    gui.add({a : false}, 'a').name('Invert X').onChange(getUnifSetter(symPass.uniforms.invertX));
    gui.add({a : false}, 'a').name('Invert Y').onChange(getUnifSetter(symPass.uniforms.invertY));
    gui.add({a : false}, 'a').name('Mirror X').onChange(getUnifSetter(symPass.uniforms.mirrorX));
    gui.add({a : false}, 'a').name('Mirror Y').onChange(getUnifSetter(symPass.uniforms.mirrorY));
    gui.add({a : false}, 'a').name('NE-Diag').onChange(getUnifSetter(symPass.uniforms.diagNE));
    gui.add({a : false}, 'a').name('NW-Diag').onChange(getUnifSetter(symPass.uniforms.diagNW));
    gui.add({a : false}, 'a').name('Invert Color').onChange(getUnifSetter(colorPass.uniforms.invertColor));
    gui.add(colorPass.uniforms.colorStep, 'value', 0.0, 1.0).name('Color Cycle');
    gui.add(colorPass.uniforms.gain, 'value', 0.0, 1.0).name('Gain');
    // not sure why p needs to be divided by 2 here but doesn't above... #augh
    gui.add({'Border Width' : 0.1}, 'Border Width', 0.0, 0.5).onChange(
        function(p) { border.scale.set(1 + p / 2, 1 + p * aspect / 2, 1); });
    gui.addColor({'Border Color' : '#' + borderMaterial.color.getHexString()}, 
        'Border Color').onChange(getColorSetter(borderMaterial.color));
    gui.addColor({'Background Color' : '#' + bgMaterial.color.getHexString()}, 
        'Background Color').onChange(getColorSetter(bgMaterial.color));//renderPass.clearColor));
    gui.add({'Far Out, Duude' : false}, 'Far Out, Duude').onChange(
        function(shouldPass) {
            var passes = feedbackProcessor.passes;
            if (shouldPass && passes[passes.length - 1] !== RGBShiftPass) {
                passes.push(RGBShiftPass);
            } else if (!shouldPass && passes[passes.length - 1] === RGBShiftPass) {
                passes.pop();
            }
        });
    // Save as .png image using js/libs/FileSaver.js
    var saveObj = {a : function() {
        var canvas = document.getElementsByTagName("canvas")[0];
        
        if (canvas.toBlob != undefined) {
            canvas.toBlob(function(blob) { saveAs(blob, "image.png"); });
            return;
        }
        
        alert("Save image with FileSaver.js failed. Opening image in new window.");
        
        // see http://stackoverflow.com/questions/12796513/html5-canvas-to-png-file for the following
        
        var dt = canvas.toDataURL('image/png');
        
        // Force download:
        /* Change MIME type to trick the browser to downlaod the file instead of displaying it */
        //dt = dt.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
        /* In addition to <a>'s "download" attribute, you can define HTTP-style headers */
        //dt = dt.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Canvas.png');
        
        // shouldn't need to call window.close(); Chrome at least closes the tab automatically
        window.open(dt);
        
        // TODO: make it download as "canvas.png" or something instead of a file w/o extension
        
    }};
    gui.add(saveObj, 'a').name('Save Image');
    
    //////////////
    // Input setup
    //////////////
    
    inputSettings = {
        scale : -1,
        rotStep : 2 * Math.PI / 180.0,
        zStep : .025,
        xyStep : .025
    };
    
    document.addEventListener('keydown', keyboardHandler, false);

    document.addEventListener('DOMContentLoaded', function() {
                              FastClick.attach(document.body);
                              }, false);
    
    // Mouse input & handlers. Updated in animate(). // DO NOT TAKE ANYTHING BELOW SERIOUSLY -------------
    // https://github.com/mudcube/Event.js

    window.mouseDown = false;
    window.rightClick = false;
    window.mouseX = 0, window.mouseY = 0;
    window.mouseX0 = 0, window.mouseY0 = 0;
    window.cameraX0 = 0, window.cameraY0 = 0;
    window.cameraR0 = 0;
    window.touchDistance = 1;
    window.newTouchDistance = 0;
    window.touchZoom = 0;
    window.touchRotationInit = 0;
    window.touchRotation = 0;
    window.guiOffsets = {};
    
    document.addEventListener("mousedown", onMouseDown, false);
    document.addEventListener("mousemove", function(event) {
        mouseX = event.clientX;
        mouseY = c_height - event.clientY; // window y-coordinate flipped
    }, false);
    document.addEventListener("mouseup", function(event) {
        mouseDown = false;
        rightClick = false;
    }, false);
    
    // Scroll-wheel zoom input
    document.addEventListener('mousewheel', scrollHandler, false);
    document.addEventListener('DOMMouseScroll', scrollHandler, false); // firefox
    
    // Disable context menu
    document.addEventListener("contextmenu", function(e) { e.preventDefault() }, false);




    // Touch input & handlers. Disable scrolling & zooming in here.
    if (touchOn === true) {
        // Drag to pan
        document.addEventListener("touchstart", touchstart_handler, false);
        document.addEventListener("touchmove", touchmove_handler, false);
        document.addEventListener("touchend", touchend_handler, false);
        document.addEventListener("touchcancel", touchend_handler, false);
        document.addEventListener("touchleave", touchend_handler, false);

        // Rotate & zoom
    }


    function touchstart_handler(event) {
        // panning
        if (event.targetTouches.length == 1) {
            mouseX0 = event.targetTouches[0].clientX;
            mouseX = mouseX0;
            mouseY0 = c_height - event.targetTouches[0].clientY;
            mouseY = mouseY0;
            cameraX0 = feedbackCamera.position.x;
            cameraY0 = feedbackCamera.position.y;

            // disable panning when started from within gui
            guiOffsets = document.getElementsByClassName("dg main a")[0].getBoundingClientRect();

            if (mouseX > (guiOffsets.left) && (c_height - mouseY) < guiOffsets.bottom
                && mouseX < guiOffsets.right) {
                mouseDown = false;
                return;
            }

            mouseDown = true;
            rightClick = false;
        }

        // zoom/rotate
        if (event.targetTouches.length == 2) {
            mouseDown = false; // until pan references are set below

            var x1 = event.targetTouches[0].clientX;
            var x2 = event.targetTouches[1].clientX;
            var y1 = c_height - event.targetTouches[0].clientY;
            var y2 = c_height - event.targetTouches[1].clientY;

            // reset pan reference
            mouseX0 = (x1 + x2) / 2;
            mouseX = mouseX0;
            mouseY0 = (y1 + y2) / 2;
            mouseY = mouseY0;
            cameraX0 = feedbackCamera.position.x;
            cameraY0 = feedbackCamera.position.y;

            // allow pan updates
            mouseDown = true;

            // zoom
            touchDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

            // rotation
            cameraR0 = feedbackCamera.rotation.z;
            touchRotationInit = Math.atan2(y2 - y1, x2 - x1);
        }
    }

    function touchmove_handler(event) {
        event.preventDefault(); // prevents scrolling, drag-refresh, &c.

        if (event.targetTouches.length == 1) {
            mouseX = event.targetTouches[0].clientX;
            mouseY = c_height - event.targetTouches[0].clientY;
        }

        if (event.targetTouches.length == 2) {
            var x1 = event.targetTouches[0].clientX;
            var x2 = event.targetTouches[1].clientX;
            var y1 = c_height - event.targetTouches[0].clientY;
            var y2 = c_height - event.targetTouches[1].clientY;

            // avg. pan
            mouseX = (x1 + x2) / 2;
            mouseY = (y1 + y2) / 2;

            // zoom
            newTouchDistance = Math.sqrt(Math.pow(x2 - x1, 2) +
                                             Math.pow(y2 - y1, 2));
            touchZoom = -1 + newTouchDistance / touchDistance;
            feedbackCamera.translateScale(touchZoom / 2);
            touchDistance = newTouchDistance;

            // rotation
            rightClick = true;
            touchRotation = Math.atan2(y2 - y1, x2 - x1) - touchRotationInit;
        }
    }

    function touchend_handler(event) {
        if (event.targetTouches.length == 0) {
            // close shop
            mouseDown = false;
            rightClick = false;
        }
        if (event.targetTouches.length == 1) {
            // reset pan reference
            mouseX0 = event.targetTouches[0].clientX;
            mouseX = mouseX0;
            mouseY0 = c_height - event.targetTouches[0].clientY;
            mouseY = mouseY0;
            cameraX0 = feedbackCamera.position.x;
            cameraY0 = feedbackCamera.position.y;

            mouseDown = true;
            rightClick = false;
        }

        if (event.targetTouches.length == 2) {
            // zoom/rotate setup
        }
    }

    // If on a mobile device, hide the GUI & get rid of fps graph.
    if (touchOn == true) {
        gui.closed = true;
        document.getElementById("fps").style.display = "none";
    }
    
    n_f = 0;
    n_f_show = 120;
    render_time = 0;
    t_start = performance.now();
}


function animate() {
    if (mouseDown) {
        // redo control flow here, it's terrible omg

        // Right-click drag rotation
        if (rightClick == true) {
            if (touchOn == true) {
                // rotation
                feedbackCamera.rotation.z = cameraR0 - touchRotation;
                feedbackCamera.position.x =
                    Math.cos(touchRotation) * cameraX0 - Math.sin(touchRotation) * cameraY0;
                feedbackCamera.position.y =
                    Math.sin(touchRotation) * cameraX0 + Math.cos(touchRotation) * cameraY0;
                cameraX0 = feedbackCamera.position.x;
                cameraY0 = feedbackCamera.position.y;

                // panning
                var transElementsI = feedbackCamera.matrixWorldInverse.elements
                var dx = inputSettings.xyStep * (mouseX - mouseX0) * 40 / c_width
                / feedbackCamera.getScale();
                var dy = inputSettings.xyStep * (mouseY - mouseY0) * 40 / c_height
                / feedbackCamera.getScale();

                var new_dx = transElementsI[0] * dx + transElementsI[1] * dy;
                var new_dy = transElementsI[4] * dx + transElementsI[5] * dy;

                feedbackCamera.position.x = cameraX0 - new_dx;
                feedbackCamera.position.y = cameraY0 - new_dy;
            }
            else {
                feedbackCamera.rotation.z = cameraR0 + 2 * Math.PI *
                    (mouseX - mouseX0) / c_width / feedbackCamera.getScale();
            }
        }

        else {
            // only pan
            var dx = inputSettings.xyStep * (mouseX - mouseX0) * 40 / c_width
                / feedbackCamera.getScale();
            var dy = inputSettings.xyStep * (mouseY - mouseY0) * 40 / c_height
                / feedbackCamera.getScale();
            
            var transElements = feedbackCamera.matrixWorldInverse.elements;
            
            var new_dx = transElements[0] * dx + transElements[1] * dy;
            var new_dy = transElements[4] * dx + transElements[5] * dy;
            
            feedbackCamera.position.x = cameraX0 - new_dx;
            feedbackCamera.position.y = cameraY0 - new_dy;
        }
    }

    //updateInput();
    t1 = performance.now();
    render();
    render_time += performance.now() - t1;
    n_f += 1;

    if (n_f % n_f_show == 0) {
        // console.log('avg render time per frame: ' + render_time / n_f_show);
        // console.log('avg time per animation frame: ' + ((performance.now() - t_start) / n_f_show));
        n_f = 0;
        render_time = 0;
        t_start = performance.now();
    }

    requestAnimationFrame(animate);

    stats.update();
}


function updateInput() {

}


function render() {

    /*
     * Notes:
     * When the feedback camera is rotated, you can see inner frames rotate 
     * for a single frame before popping back into place. This is due to displaying
     * before updating the texture. This effect is less noticable the smaller the
     * change in camera position.
     */

    // We want to update the current feedback target.
    TVMaterial.map = feedbackTarget[i_loop];

    /*
     * This applies the rendering stack to produce the feedback texture.
     * First, the scene is rendered to an internal render target. The
     * target is autocleared by default. Then, the symmetry and color
     * shaders are applied in succession. After all the passes have been
     * applied, feedbackProcessor.readBuffer contains the updated feedback
     * texture.
     */
    feedbackProcessor.render()

    // Swap the updated feedback texture with the old one.
    var temp;
    if (feedbackProcessor.readBuffer === feedbackProcessor.renderTarget1) {
        temp = feedbackProcessor.renderTarget1;
        feedbackProcessor.renderTarget1 = feedbackTarget[i_loop]; 
    } else {
        temp = feedbackProcessor.renderTarget2;
        feedbackProcessor.renderTarget2 = feedbackTarget[i_loop];
    }

    feedbackTarget[i_loop] = temp;

    // We want to update the current feedback target.
    TVMaterial.map = feedbackTarget[i_loop];

    // Render the viewScene to the screen.
    renderer.render(viewScene, viewCamera);

    i_loop = (i_loop + 1) % feedbackTarget.length;
}


function createScalableOrthoCam(aspect, minScale, maxScale) {
    // The camera sees things as scale times larger than they actually are.

    camera = new THREE.OrthographicCamera(-aspect / 2, aspect / 2, 0.5, -0.5, 0.1, 100);

    camera.minScale   = minScale;
    camera.maxScale   = maxScale;

    var internalScale = 1;

    camera.setScale = function (s) {

        if (s < this.minScale || s > this.maxScale) return;

        this.left = -aspect / 2 / s;
        this.right = aspect / 2 / s;
        this.top = 0.5 / s;
        this.bottom = -0.5 / s;

        internalScale = s;

        this.updateProjectionMatrix();

        // this.scale.x = s;
        // this.scale.y = s;
    };

    camera.getScale = function() {
        return internalScale;
    };

    camera.translateScale = function(ds) {
        this.setScale(internalScale + ds);
    };

    return camera;
}

function keyboardHandler(evt) {
    //evt = evt || window.event;
    var charCode = evt.keyCode || evt.which;
    var charStr = String.fromCharCode(charCode);

    switch(charStr) {
        case "A":
            feedbackCamera.rotateOnAxis(new THREE.Vector3(0, 0, -1),
                - inputSettings.scale * inputSettings.rotStep);
            break;
        case "D":
            feedbackCamera.rotateOnAxis(new THREE.Vector3(0, 0, -1),
                inputSettings.scale * inputSettings.rotStep);
            break;
        case "W":
            feedbackCamera.translateScale(inputSettings.zStep);
            break;
        case "S":
            feedbackCamera.translateScale(-inputSettings.zStep);
            break;
        case "J":
            feedbackCamera.translateX(- inputSettings.scale * 
                inputSettings.xyStep);
            break;
        case "L":
            feedbackCamera.translateX(inputSettings.scale * 
                inputSettings.xyStep);
            break;
        case "I":
            feedbackCamera.translateY(inputSettings.scale * 
                inputSettings.xyStep);
            break;
        case "K":
            feedbackCamera.translateY(- inputSettings.scale * 
                inputSettings.xyStep);
            break;
        case " ":
            console.log("space");
            break;
    }
}

onMouseDown = function(event) {
    // prevents canvas mouse events when clicking on gui, assuming gui is 
    //   bound to north #hack
    // killing event bubbling means changing the mousedown handlers in 
    //   dat.gui, which seems more difficult than this. retrieving guiOffsets
    //   probably doesn't need to happen every mousedown, but it also doesn't 
    //   introduce any problems/lag

    mouseDown = true;
    mouseX0 = event.clientX;
    mouseX = mouseX0;
    mouseY0 = c_height - event.clientY;
    mouseY = mouseY0;

    cameraX0 = feedbackCamera.position.x;
    cameraY0 = feedbackCamera.position.y;

    window.guiOffsets = document.getElementsByClassName("dg main a")[0].getBoundingClientRect();
    if (mouseX > (guiOffsets.left - 4) && (c_height - mouseY) < guiOffsets.bottom
        && mouseX < guiOffsets.right) {
        return;
    }

    if (event.button == 2) { // probably not very compatible
        rightClick = true;
        cameraR0 = feedbackCamera.rotation.z;
    }
}

function scrollHandler(evt) {
    // disable window scroll handler when mouse is within the gui box
    window.guiOffsets = document.getElementsByClassName("dg main a")[0].getBoundingClientRect();
    if (mouseX > (guiOffsets.left - 4) && (c_height - mouseY) < guiOffsets.bottom
        && mouseX < guiOffsets.right) {
        return;
    }
    
    var d = ((typeof evt.wheelDelta != "undefined") ? (-evt.wheelDelta) : 
        evt.detail);
    d = ((d > 0) ? 1 : -1);
    
    // Factor of 5 smooths out zoom
    feedbackCamera.translateScale(d * inputSettings.zStep / 5);
}
