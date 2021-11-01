
const get_coords = (tleLine1, tleLine2, date) => {
    //esta funcion nos permite traducir la info en formato TLE, regresa las coordenadas

    // Initialize a satellite record
    var satrec = satellite.twoline2satrec(tleLine1, tleLine2);

    //  Propagate satellite using time since epoch (in minutes).
    //var positionAndVelocity = satellite.sgp4(satrec, timeSinceTleEpochMinutes);

    //  Or you can use a JavaScript Date
    var positionAndVelocity = satellite.propagate(satrec, date);

    // The position_velocity result is a key-value pair of ECI coordinates.
    // These are the base results from which all other coordinates are derived.
    var positionEci = positionAndVelocity.position,
        velocityEci = positionAndVelocity.velocity;

    // You will need GMST for some of the coordinate transforms.
    // http://en.wikipedia.org/wiki/Sidereal_time#Definition
    var gmst = satellite.gstime(new Date());

    // You can get ECF, Geodetic, Look Angles, and Doppler Factor.
    var positionEcf   = satellite.eciToEcf(positionEci, gmst),
        positionGd    = satellite.eciToGeodetic(positionEci, gmst);

    // The coordinates are all stored in key-value pairs.
    // ECI and ECF are accessed by `x`, `y`, `z` properties.
    var satelliteX = positionEci.x,
        satelliteY = positionEci.y,
        satelliteZ = positionEci.z;

    // Geodetic coords are accessed via `longitude`, `latitude`, `height`.
    var longitude = positionGd.longitude,
        latitude  = positionGd.latitude,
        height    = positionGd.height;

    //  Convert the RADIANS to DEGREES.
    var longitudeDeg = satellite.degreesLong(longitude),
        latitudeDeg  = satellite.degreesLat(latitude);

    return {
        "longitude" : longitudeDeg,
        "latitude" : latitudeDeg,
        "height" : height*1000
    };
}

const get_polygon = (coords) => {
    //esta funcion es para crear una objeto con dimenciones predefinidas pero con
    //coordenadas como paremetro

    //creamos una forma con los atributos por defecto
    var polygonAttributes = new WorldWind.ShapeAttributes(null);
    //le agregamos el colore del interior en formato rgba
    polygonAttributes.interiorColor = new WorldWind.Color(1, 0, 0, 0.75);
    //definimos el color del border del objeto
    polygonAttributes.outlineColor = WorldWind.Color.RED;
    //permitimos que se visualice el borde del objeto (desactivado por defecto)
    polygonAttributes.drawOutline = true;
    //aplicamos matices de la luz en el objeto (desactivado por defecto)
    polygonAttributes.applyLighting = true;

    //el valor que usamos para darle 2 dimenciones al objeto de la basura, solo 2 para no impactar mucho en memoria
    const trash_size = 1;

    var boundaries = [];
    //latitude, longitude, altitude
    boundaries.push(new WorldWind.Position(coords.latitude, coords.longitude, coords.height));
    boundaries.push(new WorldWind.Position(coords.latitude+trash_size, coords.longitude, coords.height));
    boundaries.push(new WorldWind.Position(coords.latitude+trash_size, coords.longitude+trash_size, coords.height));
    boundaries.push(new WorldWind.Position(coords.latitude, coords.longitude+trash_size, coords.height));

    var polygon = new WorldWind.Polygon(boundaries, polygonAttributes);
    polygon.extrude = false;

    return polygon;
}

const set_layer_display = (layer, is_visible) => {
    //funcion para ocular capas

    layer.enabled = (is_visible) ? true : false;
    wwd.redraw();

    //es esta, solo modifica si te fijas, en el documento de docs, todos tienen su id
    //el m6 lo esta haciendo Omar, aun no termina

    //PREDICT_LAYER.enabled = false;
}


//creamos el canvas
var wwd = new WorldWind.WorldWindow("canvasOne");

//agregar capa inicial de resolucion baja
wwd.addLayer(new WorldWind.BMNGOneImageLayer());
//capa de resolucion alta
wwd.addLayer(new WorldWind.BMNGLandsatLayer());

//agregamos la brujula
wwd.addLayer(new WorldWind.CompassLayer());
//agregamos la capa para las coordenadas
wwd.addLayer(new WorldWind.CoordinatesDisplayLayer(wwd));
//agregamos la capa para los controles (botones) del mundo
wwd.addLayer(new WorldWind.ViewControlsLayer(wwd));

//guardamos la fecha de este momento y definimos algunas constantes de tiempo en milisegundos
let current_date = new Date();
const ONE_MINUTE = 1000 * 60;
const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = 1000 * 60 * 60 * 24;


let GROUPS = [];

//para guardar el ultimo texto y eliminarlo correctamente
LAST_TEXT = {
    object: null,
    layer : null
};

const load_data = () => {
    let files = ["./data_cosmos.txt", "./data_iridium.txt"];
  
    let load_tasks = [];
  
    for (let file in files) {
      const name = files[file].split(/\//)[1];
  
      let new_task = new Promise((resolve, reject) => {
        fetch(files[file])
          .then((response) => response.text())
          .then((content) => {
            //separamos la info por linea
  
            content = content.split(/\n/);
  
            //counter para saber en que linea vamos, se usa de 0 a 2 y se reinicia
            let endofline_counter = 0;
            let new_groups_row = {
              trash: [],
              layer: name.split(/\./)[0],
            };
            let new_trash_row = null;
  
            content.forEach((line) => {
              if (endofline_counter == 0) {
                new_trash_row = {
                  name: null,
                  line1: null,
                  line2: null,
                };
              }
  
              switch (endofline_counter) {
                case 0:
                  new_trash_row.name = line;
                  break;
                case 1:
                  new_trash_row.line1 = line;
                  break;
                case 2:
                  new_trash_row.line2 = line;
  
                  new_groups_row.trash.push(new_trash_row);
                  break;
              }
  
              endofline_counter =
                endofline_counter == 2 ? 0 : endofline_counter + 1;
            });
  
            //creamos una nueva capa, la ocultamos y la agregamos al row del grupo
            let new_layer = new WorldWind.RenderableLayer();
            set_layer_display(new_layer, false);
            new_groups_row.layer = new_layer;
            wwd.addLayer(new_layer);

            GROUPS.push(new_groups_row);
  
            const list = document.getElementById("list-items");
            var el = document.createElement("p");
            el.innerHTML += `${name.split(/\./)[0]}`;
            el.setAttribute("value", name.split(/\./)[0]);
            list.appendChild(el);
            el.addEventListener("click", function (e) {
                if (LAST_TEXT.object != null) {
                    LAST_TEXT.layer.removeRenderable(LAST_TEXT.object);
                    lastSelected = null;
                }

                for (let group in GROUPS) {
                    if (group == file) {
                        set_layer_display(GROUPS[group].layer ,true);
                    } else {
                        set_layer_display(GROUPS[group].layer ,false);
                    }
                }
                set_layer_display(PREDICT_LAYER ,false);
            });
            fill_layer_from_data(file);
            resolve(1);
          });
      });
    }
  
    Promise.all(load_tasks).then((r) => {
      console.log(GROUPS);
      //console.log(r);
    });
  };

const load_hour_display = () => {

    const update_hour_display = () => {
        let current_hour_el = document.querySelector("#current-hour");
        let current_date = new Date();
        let hours = current_date.getHours();
        hours = (hours < 10) ? "0" + hours : hours;
        let minutes = current_date.getMinutes();
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        let seconds = current_date.getSeconds();
        seconds = (seconds < 10) ? "0" + seconds : seconds;
        current_hour_el.textContent = hours + ":" + minutes + ":" + seconds;
    }

    window.setInterval(() => {
        update_hour_display();
    }, 1000);
}

const input_search_behaviur = () => {

    let input = document.querySelector("#group-search");
    let group_items_container = document.querySelector(".tg-items-container");
    
    input.addEventListener("keyup", event => {
        let value = event.target.value;
        group_items_container.querySelectorAll("p").forEach(each => {
            let content = each.textContent;
            if (content.toUpperCase().search(value) == 0 || content.toLowerCase().search(value) == 0) {
                each.classList.remove("hidden");
            } else {
                each.classList.add("hidden");
            }
        });
    });
}

const fill_layer_from_data = (groups_index) => {
    GROUPS[groups_index].trash.forEach((t, i) => {
        let skip_object = false;
        let trash_coords;

      try {
        trash_coords = get_coords(
            t.line1,
            t.line2,
            new Date()
          );
      } catch (e) {
          skip_object = true;
      }

      if (!skip_object) {
        let new_polygon = get_polygon(trash_coords);
        new_polygon.groupIndex = parseInt(groups_index);
        new_polygon.trashIndex = i;
        GROUPS[groups_index].layer.addRenderable(new_polygon);
      }
    });
  };
  


load_hour_display();
load_data();
input_search_behaviur();


const get_text = (content, coords) => {
    let text;
    let textAttributes = new WorldWind.TextAttributes(null);

    // Set up the common text attributes.
    textAttributes.color = WorldWind.Color.RED;
    // Set the depth test property such that the terrain does not obscure the text.
    textAttributes.depthTest = false;

    let position = new WorldWind.Position(
        get_polygon(coords).referencePosition.latitude,
        get_polygon(coords).referencePosition.longitude,
        get_polygon(coords).referencePosition.altitude
    );
    text = new WorldWind.GeographicText(position, content);

    // Set the text attributes for this shape.
    text.attributes = textAttributes;

    return text;
}

const test1 = () => {
    //creamos una nueva capa
    var polygonLayer = new WorldWind.RenderableLayer();
    //la agregamos a worldwind
    wwd.addLayer(polygonLayer);

    //prueba de prediccion COMENTAR ESTO
    for (let i = 0; i < 100; i++) {
        let trash_coords = get_coords(
            "1 22675U 93036A   21269.40469457  .00000015  00000-0  15215-4 0  9996",
            "2 22675  74.0378 244.8818 0025430 341.1003  18.9201 14.32581054477400",
            //aqui lo que hacemos es ir aumentando en un segundo mas cada iteracion
            new Date(current_date.getMilliseconds()+(ONE_MINUTE*i))
        );
    
        //agregamos la info de la basura a la capa
        polygonLayer.addRenderable(get_text("basura", trash_coords));
        polygonLayer.addRenderable(get_polygon(trash_coords));
    }

    //set_layer_display(polygonLayer, false);
}

const show_trash_details = (polygon) => {
    let trash_raw_info = GROUPS[polygon.groupIndex].trash[polygon.trashIndex];
    let coords = get_coords(trash_raw_info.line1,trash_raw_info.line2, new Date());

    let layer = GROUPS[polygon.groupIndex].layer;
    if (LAST_TEXT.object != null) {
        LAST_TEXT.layer.removeRenderable(LAST_TEXT.object);
    }

    LAST_TEXT.layer = layer;
    LAST_TEXT.object = get_text(trash_raw_info.name, coords);
    layer.addRenderable(LAST_TEXT.object);
    
    document.querySelector("#longitude").textContent = coords.longitude;
    document.querySelector("#latitude").textContent = coords.latitude;
    document.querySelector("#altitude").textContent = coords.height;

    let line1_arr = trash_raw_info.line1.split(" ");
    let line2_arr = trash_raw_info.line2.split(" ");
    document.querySelector("#info0").textContent = line2_arr[1];
    document.querySelector("#info1").textContent = line1_arr[10];
    document.querySelector("#info2").textContent = trash_raw_info.name;
}


const predict_form = () => {
    let input = document.querySelector("#date-input");
    let button = document.querySelector("#do-predict");

    //creamos una capa para los objetos de prediccion

    PREDICT_LAYER = new WorldWind.RenderableLayer();
    wwd.addLayer(PREDICT_LAYER);

    button.addEventListener("click", () => {
        if (input.value == "") {
            alert("Define una fecha");
        } else if (lastSelected == null) {
            alert("Seleccion primero algun objeto");
        } else {
            let trash_row = GROUPS[lastSelected.groupIndex].trash[lastSelected.trashIndex];
            let coords = get_coords(trash_row.line1, trash_row.line2, new Date(input.value));

            PREDICT_LAYER.removeAllRenderables();

            PREDICT_LAYER.addRenderable(get_polygon(coords));
            PREDICT_LAYER.addRenderable(get_text(trash_row.name, coords));
            set_layer_display(PREDICT_LAYER, true);
            set_layer_display(GROUPS[0].layer, false);
            set_layer_display(GROUPS[1].layer, false);
        }
    });
}
predict_form();





//lo sigueinte es para reconocer los objetos que reciben un click, estos se iran agregando al array de highlightedItems
var lastSelected = null;
var handlePick = function (o) {
    // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
    // the mouse or tap location.
    var x = o.clientX,
        y = o.clientY;

    var redrawRequired = lastSelected != null;

    // De-highlight any highlighted placemarks.
    if (lastSelected != null) {
        lastSelected.highlighted = false;
    }
    lastSelected = null;

    // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
    // relative to the upper left corner of the canvas rather than the upper left corner of the page.
    var rectRadius = 1,
        pickPoint = wwd.canvasCoordinates(x, y),
        pickRectangle = new WorldWind.Rectangle(pickPoint[0] - rectRadius, pickPoint[1] + rectRadius,
            2 * rectRadius, 2 * rectRadius);

    var pickList = wwd.pickShapesInRegion(pickRectangle);
    if (pickList.objects.length > 0) {
        redrawRequired = true;
    }

    //CHEQUEN QUE PICK LIST TIENE EL RESULTADO DEL CLICK
    //SI SE DETECTA ALGO EL LENGTH DE PICK SE AUMENTA

    // Highlight the items picked.
    if (pickList.objects.length > 0) {
        for (var p = 0; p < pickList.objects.length; p++) {
            if (pickList.objects[p].isOnTop) {
                //se imprime el objeto que recibe un click
                lastSelected = pickList.objects[p].userObject;
                lastSelected.highlighted = true;
                //lastSelected.attributes.interiorColor = {red:0, green:0, blue:0, alpha:1};
                show_trash_details(lastSelected);
            }
        }
    }

    // Update the window if we changed anything.
    if (redrawRequired) {
        wwd.redraw();
    }
};

// Listen for mouse moves and highlight the placemarks that the cursor rolls over.
wwd.addEventListener("click", handlePick);

// Listen for taps on mobile devices and highlight the placemarks that the user taps.
var tapRecognizer = new WorldWind.TapRecognizer(wwd, handlePick);




