let krakowBoundary = null;
let setTrip = true;
let startCoords = null;
let lastMarker = null;
let selectedFilters = [];
let coordsFlag = false;
let distanceFlag = false;
let optionsFlag = false;
let abortController = null;
let markers = [];
let routes = [];
let borders = [];
let profiles = [];

const formContainer = document.getElementById("form-container");
const routeForm = document.getElementById("route-form");
const tripDistance = document.getElementById("trip-distance");
const filterOptions = document.querySelectorAll(".filter-option");
const confirmButton = document.getElementById("confirm-button");
const newTripButton = document.getElementById("new-trip-button");
const startCoordsError = document.getElementById("start-coords-error");
const tripDistanceError = document.getElementById("trip-distance-error");
const typeFilterError = document.getElementById("type-filter-error");
const errorMessageBox = document.getElementById("message-container");

const colorPalette = [ '#702963', '#2D680D','#6EAABE', '#A28834','#2E5894' ];

const orangeIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt orange-icon"></i>',
    className: '',
    iconSize: [37, 37],
    iconAnchor: [18.5, 37]
});

const blackIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt black-icon"></i>',
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30]
});

const map = L.map('map').setView([50.04410, 19.95824], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    zoomControl: false,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

fetch("/static/boundary/krakow_boundary.json")
    .then(response => response.json())
        .then(data => {
            krakowBoundary = L.geoJSON(data, {
                style: {
                    color: '#696880',
                    weight: 4,
                    fillOpacity: 0
                }
            }).addTo(map);
        });

function isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }
    return inside;
}

function isPointInsideKrakow(point, geoJsonLayer) {
    const latLng = [point.lat, point.lng];
    let isInside = false;

    geoJsonLayer.eachLayer(function (layer) {
        const polygon = layer.getLatLngs();

        if (isPointInPolygon(latLng, polygon[0])) {
            isInside = true;
        }
    });
    return isInside;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function distancesArrayForProfile(route){
    const distances = [];
            let cumulativeDistance = 0;
            for (let i = 0; i < route.length; i++) {
                if (i > 0) {
                    const lat1 = route[i - 1][0];
                    const lon1 = route[i - 1][1];
                    const lat2 = route[i][0];
                    const lon2 = route[i][1];
                    const segmentDistance = calculateDistance(lat1, lon1, lat2, lon2);
                    cumulativeDistance += segmentDistance;
                }
                distances.push(cumulativeDistance.toFixed(2));
            }
            return distances
}
function isAnyOptionSelected() {
    for (let option of filterOptions) {
        if (option.classList.contains("selected")) {
            return true;
        }
    }
    return false;
}

function showLoader(loaderId) {
    document.getElementById(loaderId).style.display = 'flex';
}

function hideLoader(loaderId) {
    document.getElementById(loaderId).style.display = 'none';
}

function removeRoutes(){
    routes.forEach(route => map.removeLayer(route));
    borders.forEach(border => map.removeLayer(border));
    markers.forEach(routeMarkers => {
        routeMarkers.forEach(marker => map.removeLayer(marker));
    });
}

function highlightRouteAndProfile(index) {
    profiles.forEach((profile, i) => {
        if (i === index) {
            profile.classList.add('highlighted');
            profile.classList.remove('blurred');
        } else {
            profile.classList.add('blurred');
            profile.classList.remove('highlighted');
        }
    });

    removeRoutes();
    borders[index].addTo(map);
    routes[index].addTo(map);
    markers[index].forEach(marker => marker.addTo(map));
}

function showAllRoutesAndProfiles() {
        profiles.forEach(profile => {
            profile.classList.remove('blurred', 'highlighted');
        });

    borders.forEach(border => border.addTo(map));
    routes.forEach(route => route.addTo(map));
    markers.forEach(routeMarkers => {
        routeMarkers.forEach(marker => marker.addTo(map));
    });
}

function setupInteractivity() {
    profiles.forEach((profile, index) => {
        profile.addEventListener('click', () => {
            highlightRouteAndProfile(index);
        });
    });

    map.on('click', () => {
        showAllRoutesAndProfiles();
    });
}

function resetAll() {
    const elevationsContainer = document.getElementById("elevations-container");
    while (elevationsContainer.firstChild) {
        elevationsContainer.removeChild(elevationsContainer.firstChild);
    }

    removeRoutes();
    markers = [];
    routes = [];
    borders = [];
    setTrip = true;
}

map.on('click', function (e) {
    if (!setTrip) {
        return;
    }

    startCoords = e.latlng;

    if (!isPointInsideKrakow(startCoords, krakowBoundary)) {
        startCoordsError.textContent = "punkt nie jest w granicach Krakowa";
        startCoordsError.style.visibility = "visible";
        document.getElementById("start-coords").innerHTML = `
           <p>1. Kliknij na mapę by wybrać punkt startowy:</p>
        `;

        if (lastMarker) {
            map.removeLayer(lastMarker);
        }

        coordsFlag = false;
        return;
    }

    startCoordsError.textContent = "";
    startCoordsError.style.visibility = "hidden";
    if (lastMarker) {
        map.removeLayer(lastMarker);
    }

    document.getElementById("start-coords").innerHTML = `
        <p>1. Punkt z którego zaczynasz:</p>
        <span class="chosen-coords">
            ${startCoords.lat.toFixed(5)}, ${startCoords.lng.toFixed(5)}
        </span>
    `;

    lastMarker = L.marker([startCoords.lat.toFixed(5), startCoords.lng.toFixed(5)], {
        icon: blackIcon
    }).addTo(map);

    coordsFlag = true;
});

tripDistance.addEventListener("blur", function (e) {
   const input = parseInt(e.target.value, 10);

    if (input < 5) {
        tripDistanceError.textContent = "dystans musi być dłuższy niż 5 km";
        tripDistanceError.style.visibility = "visible";
        distanceFlag = false;
    } else if (input > 100) {
        tripDistanceError.textContent = "dystans musi być krótszy niż 100 km";
        tripDistanceError.style.visibility = "visible";
        distanceFlag = false;
    }else if(!tripDistance.value.trim()){
        tripDistanceError.textContent = "podaj dystans wycieczki";
        tripDistanceError.style.visibility = "visible";
        distanceFlag = false;
    }else{
        tripDistanceError.textContent = "";
        tripDistanceError.style.visibility = "hidden";
        distanceFlag = true;
    }
});

filterOptions.forEach(option => {
    option.addEventListener('click', function () {
        const type = this.getAttribute('data-type');

        if (selectedFilters.includes(type)) {
            selectedFilters = selectedFilters.filter(item => item !== type);
            this.classList.remove('selected');
        } else {
            selectedFilters.push(type);
            this.classList.add('selected');

            typeFilterError.textContent = "";
            typeFilterError.style.visibility = "hidden";
        }
    });
});

confirmButton.addEventListener("click", function () {
    if (!isAnyOptionSelected()) {
        typeFilterError.textContent = "wybierz przynajmniej jedną kategorię";
        typeFilterError.style.visibility = "visible";
        optionsFlag = false;
    }else{
        typeFilterError.textContent = "";
        typeFilterError.style.visibility = "hidden";
        optionsFlag = true;
    }

    if(!distanceFlag){
        tripDistanceError.textContent = "podaj dystans wycieczki";
        tripDistanceError.style.visibility = "visible";
    }

    if(!coordsFlag){
        startCoordsError.textContent = "wybierz punkt startowy";
        startCoordsError.style.visibility = "visible";
    }

    if(!coordsFlag || !distanceFlag || !optionsFlag){
        return;
    }

    if (errorMessageBox.style.display === "flex") {
        errorMessageBox.style.display = "none";
    }

    const distanceValue = parseInt(document.getElementById("trip-distance").value, 10);

    formContainer.classList.add("collapsed");
    formContainer.style.height = "8%";

    setTimeout(() => {
        routeForm.classList.add("hidden");
        newTripButton.classList.remove("hidden");
    }, 1500);

    loadRoute(startCoords, distanceValue, selectedFilters);
});

newTripButton.addEventListener("click", function () {
    if (abortController) {
        abortController.abort();
        hideLoader('elevation-loader');
    }

    newTripButton.classList.add("hidden");
    formContainer.classList.remove("collapsed");
    formContainer.style.height = "80%";

    setTimeout(() => {
        routeForm.classList.remove("hidden");
    }, 500);

    resetAll();
});

async function loadRoute(startCoords, tripDistance, typeFilter) {
    showLoader('route-loader');
    setTrip = false;

    abortController = new AbortController();
    const signal = abortController.signal;

    try {
        const apiUrl = `trip?start-lat=${startCoords.lat}&start-lng=${startCoords.lng}&trip-distance=${tripDistance}&type-filter=${typeFilter.join(',')}`;
        const response = await fetch(apiUrl, {signal});

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        data.points.forEach((route, index) => {
            const latLngs = route.map(point => [point[0], point[1]]);
            const color = colorPalette[index];

            const borderPolyline = L.polyline(latLngs, {color: 'black', weight: 6, opacity: 0.7});
            const polyline = L.polyline(latLngs, {color: color, weight: 4, interactive: true, opacity: 1});

            borderPolyline.addTo(map);
            polyline.addTo(map);

            routes.push(polyline);
            borders.push(borderPolyline);
        });

        map.removeLayer(lastMarker);
        lastMarker = L.marker([startCoords.lat.toFixed(5), startCoords.lng.toFixed(5)], {
            icon: orangeIcon
        }).addTo(map);

        data.places.forEach(placeGroup => {
            let route_markers = []
            placeGroup.forEach(place => {
                let marker = L.marker([place.latitude, place.longitude], {icon: blackIcon}).bindPopup(`
                    <div class="popup-container">
                        <div class="popup-name">${place.name}</div>
                        <img src="/static/images/${place.image}.jpg" alt="${place.name} " class="popup-image">
                        <div class="popup-description">${place.description}</div>
                    </div>
                `);

                document.addEventListener('click', function (e) {
                    if (e.target && e.target.id === 'custom-close-btn') {
                        map.closePopup();
                    }
                });

                marker.addTo(map);
                route_markers.push(marker);
            });
            markers.push(route_markers);
        });

        hideLoader('route-loader');
        showLoader('elevation-loader');

        const elevationResponse = await fetch(`/zuzu_maps/trip`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                points: data.points
            }),
            signal
        });

        const withElevationData = await elevationResponse.json();

        const profileNumber = data.points.length;
        let profileHeight = 200;

        if (profileNumber > 3) {
            profileHeight = Math.max(100, window.innerHeight / profileNumber);
        }

        withElevationData.points.forEach((route, index) => {

            const distances = distancesArrayForProfile(route);
            const elevations = route.map(point => point[2]);
            const totalDistance = data.distances[index];

            const elevationItem = document.createElement("div");
            elevationItem.className = "elevation-item";
            elevationItem.style.backgroundColor = colorPalette[index]

            const infoDiv = document.createElement("div");
            infoDiv.className = "elevation-info";
            infoDiv.style.height = `${profileHeight}px`
            infoDiv.innerHTML = `<div class="route">trasa ${index + 1}</div>
                <div class="distance">DYSTANS:</div>
                <div class="number">${totalDistance} km</div>
            `;

            const elevationDiv = document.createElement("div");
            elevationDiv.className = "elevation-profile";
            elevationDiv.id = `elevation-profile-${index}`;
            elevationDiv.style.height = `${profileHeight}px`

            elevationItem.appendChild(infoDiv);
            elevationItem.appendChild(elevationDiv);
            document.getElementById("elevations-container").appendChild(elevationItem);

            Plotly.newPlot(elevationDiv.id, [{
                x: distances,
                y: elevations,
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: '#F5A342',
                    shape: 'spline',
                    smoothing: 50,
                    width: 2
                },
                fill: 'tozeroy',
                fillcolor: 'rgba(249, 177, 102, 0.5)'
            }], {
                margin: {
                    t: 10,
                    b: 40,
                    l: 40,
                    r: 10
                },
                xaxis: {
                    title: false,
                    showgrid: false,
                    zeroline: false,
                    color: "#FFFFFF",
                    linecolor: "#FFFFFF",
                    tickcolor: "#FFFFFF",
                    linewidth: 1.5,
                    ticklen: 8
                },
                yaxis: {
                    title: false,
                    zeroline: false,
                    range: [Math.min(...elevations) - 10, Math.max(...elevations) + 20],
                    color: "#FFFFFF",
                    linecolor: "#FFFFFF",
                    tickcolor: "#FFFFFF",
                    linewidth: 1.5,
                    ticklen: 5,
                    showgrid: true,
                    gridcolor: "rgba(255, 255, 255, 0.2)",
                    gridwidth: 1
                },
                plot_bgcolor: "rgba(51, 51, 51, 1)",
                paper_bgcolor: "rgba(51, 51, 51, 0.8)",
                font: {
                    color: "#FFFFFF"
                }
            }, {
                displayModeBar: false
            });
        });

        profiles = document.querySelectorAll('.elevation-item');

        hideLoader('elevation-loader');
        setupInteractivity();

    } catch (error) {
        if (abortController) {
            abortController.abort();
        }
        hideLoader('route-loader');

        if(error.message == "444") {
            setTimeout(() => {
                const errorMessageContainer = document.getElementById("message-container");
                const errorMain = document.getElementById("message-main");
                const errorBase = document.getElementById("message-below");
                const errorCloseBtn = document.getElementById("message-close-button");

                errorMain.innerHTML = `Brak dostatecznej ilości punktów
                z tej kategorii
               <br>w podanym zasięgu,</br>
            `;
                errorBase.innerHTML = `zmień parametry wycieczki.`;
                errorMessageContainer.style.display = "flex";

                errorCloseBtn.addEventListener("click", () => {
                    errorMessageContainer.style.display = "none";
                });
            }, 1000);

            setTimeout(() => {
                newTripButton.click();
            }, 2000);
        }
    }
}