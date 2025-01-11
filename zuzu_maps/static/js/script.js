
const map = L.map('map').setView([50.061485, 19.937978], 13); // Kraków

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let startCoords = null;
let selectedFilters = [];
let lastMarker = null;
let setTrip = true;
let markers = []
let routes = [];
let borders = []
let isCancelled = false; // Flaga przerwania operacji
let abortController = null; // Globalny kontroler anulowania


function showLoader(loaderId) {
    document.getElementById(loaderId).style.display = 'flex';
}

function hideLoader(loaderId) {
    document.getElementById(loaderId).style.display = 'none';
}

const colorPalette = ['#A28834', '#2D680D', '#6eaaBE', '#702963', '#2E5894'];

    // Funkcja podświetlająca trasę i profil
function highlightRouteAndProfile(index, elevationProfiles, routes, borders, markers) {

    routes.forEach(route => map.removeLayer(route));
    borders.forEach(border => map.removeLayer(border));
    markers.forEach(routeMarkers => {
        routeMarkers.forEach(marker => map.removeLayer(marker)); // Iteracja po wewnętrznych tablicach markerów
    });

    // Podświetl wybrany profil
    elevationProfiles.forEach((profile, i) => {
        if (i === index) {
            profile.classList.add('highlighted');
            profile.classList.remove('blurred');
        } else {
            profile.classList.add('blurred');
            profile.classList.remove('highlighted');
        }
    });

    const selectedBorder = borders[index];
    selectedBorder.addTo(map); // Dodaj wybraną trasę na mapę

    // Dodaj tylko wybraną trasę
    const selectedRoute = routes[index];
    selectedRoute.addTo(map); // Dodaj wybraną trasę na mapę

    markers[index].forEach(marker => marker.addTo(map)); // Dodaj markery dla wybranej trasy

}

function resetAllProfiles(elevationProfiles) {
    // Usuń wszystkie efekty z profili
        elevationProfiles.forEach(profile => {
            profile.classList.remove('blurred', 'highlighted');
        });

    // Dodaj wszystkie trasy na mapę
    borders.forEach(border => border.addTo(map));
    routes.forEach(route => route.addTo(map));
    markers.forEach(routeMarkers => {
        routeMarkers.forEach(marker => marker.addTo(map)); // Poprawka: używamy `marker.addTo(map)`
    });
}

function setupInteractivity(elevationProfiles, routes, borders, markers) {
    // Obsługa kliknięcia na profil
    elevationProfiles.forEach((profile, index) => {
        profile.addEventListener('click', () => {
            highlightRouteAndProfile(index, elevationProfiles, routes, borders, markers);
        });
    });

    // // Reset efektów po kliknięciu w dowolne miejsce mapy
    map.on('click', () => {
        resetAllProfiles(elevationProfiles);
    });
}

function resetAllRoutesAndProfiles() {
    // Usuń wszystkie profile wysokościowe z DOM
    const elevationsContainer = document.getElementById("elevations-container");
    while (elevationsContainer.firstChild) {
        elevationsContainer.removeChild(elevationsContainer.firstChild);
    }

    // Usuń wszystkie trasy z mapy za pomocą funkcji resetAllProfiles
    const elevationProfiles = document.querySelectorAll('.elevation-item'); // Wybierz profile

    routes.forEach(route => map.removeLayer(route));
    borders.forEach(border => map.removeLayer(border));
    markers.forEach(routeMarkers => {
        routeMarkers.forEach(marker => map.removeLayer(marker)); // Iteracja po wewnętrznych tablicach markerów
    });
    markers = [];
    routes = [];
    borders = [];

    console.log(markers)

    // Resetowanie markerów i tras
    if (lastMarker) {
        map.removeLayer(lastMarker);
        lastMarker = null;
    }

    // Reset współrzędnych startowych
    startCoords = null;
    setTrip = true;
}



// Pobierz przycisk "Przelicz trasy"
const confirmButton = document.getElementById("confirm-btn");
const formContainer = document.getElementById("form-container");
const expandButton = document.getElementById("expand-btn");

// Obsługa przycisku
confirmButton.addEventListener("click", function () {

    const trip_distance = document.getElementById("trip_distance").value;

    loadRoute(trip_distance, selectedFilters);

    formContainer.classList.add("collapsed"); // Dodaj klasę collapsed
    formContainer.style.height = "4%";
    // document.getElementById("route-form").classList.add("hidden"); // Ukrywamy formularz
    // expandButton.classList.remove("hidden"); // Pokazujemy przycisk

    setTimeout(() => {
        document.getElementById("route-form").classList.add("hidden"); // Ukryj formularz
        expandButton.classList.remove("hidden"); // Pokaż przycisk
    }, 1000); // Czas dopasowany do `transition` formularza
});

expandButton.addEventListener("click", function () {
    expandButton.classList.add("hidden"); // Ukrywamy przycisk
    formContainer.classList.remove("collapsed"); // Usuwamy klasę collapsed
    formContainer.style.height = "70%"; // Przywracamy pełną wysokość

    isCancelled = true;

    // Anulowanie żądania fetch
    if (abortController) {
        abortController.abort(); // Anuluje żądanie fetch
    }

    const form = document.getElementById("route-form");
    form.reset(); // Resetuje wszystkie pola formularza

    // Usunięcie zaznaczeń opcji w filtrach
    const selectedOptions = document.querySelectorAll(".filter-option.selected");
    selectedOptions.forEach(option => {
        option.classList.remove("selected");
    });

    // Wyczyszczenie pola startowego współrzędnych
    const startCoords = document.getElementById("start-coords");
    startCoords.innerHTML = "1. Kliknij na mapę, by wybrać punkt startowy:";

    // Pokazujemy formularz z małym opóźnieniem, aby zsynchronizować z animacją
    setTimeout(() => {
        document.getElementById("route-form").classList.remove("hidden"); // Pokaż formularz
    }, 500); // Czas dopasowany do `transition` formularza

    resetAllRoutesAndProfiles();
    isCancelled = false;
});

// Obsługa kliknięcia na mapie
map.on('click', function (e) {

    if (!setTrip) {
        console.log("You cannot modify the start point after the route has been calculated.");
        return; // Blokowanie dalszego działania
    }
    startCoords = e.latlng;

    if (lastMarker) {
        map.removeLayer(lastMarker);
    }

    lastMarker = L.marker([startCoords.lat.toFixed(5), startCoords.lng.toFixed(5)], {icon: blackIcon}).addTo(map)
    document.getElementById("start-coords").innerHTML = `
        1. Punkt z którego zaczynasz: <br>
        <span style="display: block; text-align: center; color: #F5A342">
            ${startCoords.lat.toFixed(5)}, ${startCoords.lng.toFixed(5)}
        </span>
    `;
});


// Obsługa kliknięcia na opcjach
document.querySelectorAll('.filter-option').forEach(option => {
    option.addEventListener('click', function () {
        const type = this.getAttribute('data-type');
        if (selectedFilters.includes(type)) {
            selectedFilters = selectedFilters.filter(item => item !== type);
            this.classList.remove('selected');
        } else {
            selectedFilters.push(type);
            this.classList.add('selected');
        }
    });
});

    // Paleta kolorów

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Promień Ziemi w kilometrach
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance; // Odległość w kilometrach
}


const orangeIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #F5A342; font-size: 37px;"></i>', // Zwiększony rozmiar
    className: '', // Ensure no unwanted background styles
    iconSize: [37, 37], // Powiększony rozmiar
    iconAnchor: [18.5, 37] // Środek poziomo i zakotwiczenie na dole
});

const blackIcon = L.divIcon({
    html: '<i class="fas fa-map-marker-alt" style="color: #333; font-size: 30px;"></i>',
    className: '', // Ensure no unwanted background styles
    iconSize: [30, 30], // Adjust size to match visual size
    iconAnchor: [15, 30] // Center horizontally and anchor vertically at the bottom
});

async function loadRoute(trip_distance, typeFilter) {
    setTrip = false;

    abortController = new AbortController();
    const signal = abortController.signal;

    showLoader('route-loader');

    // Budowanie adresu URL do API z parametrami

    const apiUrl = `trip?start_lat=${startCoords.lat}&start_lng=${startCoords.lng}&trip_distance=${trip_distance}&type_filter=${typeFilter.join(',')}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    // const response = await fetch(`/static/mock.json?v=${new Date().getTime()}`);
    //
    // // const response = await fetch('/static/mock.json');
    // if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    const profileHeight = Math.max(100, window.innerHeight / data.points.length); // Dynamiczna wysokość

    console.log("API Response:", data);



    // Rysowanie tras i profili wysokości
    data.points.forEach((route, index) => {
        if (Array.isArray(route) && route.length > 1) {
            const latLngs = route.map(point => [point[0], point[1]]);

            // Wybieranie koloru z palety (cykliczne użycie kolorów)
            const color = colorPalette[index % colorPalette.length];

            // Czarna obramówka (thin background polyline for contrast)
            const borderPolyline = L.polyline(latLngs, { color: 'black', weight: 6, opacity: 0.7 });
            borderPolyline.addTo(map);

            // Właściwa trasa w kolorze z palety
            const polyline = L.polyline(latLngs, { color: color, weight: 4, interactive: true, opacity: 1 });
            polyline.addTo(map);

            routes.push(polyline);
            borders.push(borderPolyline);


        }
    });



                // Dodawanie popupów
    map.removeLayer(lastMarker);
    lastMarker = L.marker([startCoords.lat.toFixed(5), startCoords.lng.toFixed(5)], {icon: orangeIcon}).addTo(map)

    if (data.places) {
        data.places.forEach(placeGroup => {
            route_markers = []
            placeGroup.forEach(place => {
                if (place.latitude && place.longitude) {
                    marker = L.marker([place.latitude, place.longitude], { icon: blackIcon })
                        .bindPopup(`
                            <div class="popup-container">
                                <div class="popup-name">${place.name}</div>
                                <img src="/static/images/${place.image}.jpg" alt="${place.name} " class="popup-image">
                                <div class="popup-description">${place.description}</div>
                            </div>
                    `);
                    marker.addTo(map);
                    route_markers.push(marker);
                }
            });
            markers.push(route_markers)
        });
    }

    hideLoader('route-loader');
    showLoader('elevation-loader');

    try {

        const elevationResponse = await fetch(`/zuzu_maps/trip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ points: data.points }),
                signal, // Przekazanie sygnału kontrolera do fetch
            });

        const withElevationData = await elevationResponse.json(); // Konwersja odpowiedzi do JSON
        if (isCancelled) {
            hideLoader('elevation-loader');
            isCancelled = false;
            return;
        }

        console.log("API Response:", withElevationData);

        if (withElevationData.points) {
            withElevationData.points.forEach((route, index) => {
                if (isCancelled) {
                    hideLoader('elevation-loader');
                    isCancelled = false;
                    return;
                }

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
                    distances.push(cumulativeDistance.toFixed(2)); // Zaokrąglenie do 2 miejsc po przecinku
                }

                const elevations = route.map(point => point[2]);
                const totalDistance = data.distances[index]; // Całkowity dystans trasy z JSON


                const elevationItem = document.createElement("div");
                elevationItem.className = "elevation-item";

                const itemColor = colorPalette[index]; // Pobranie koloru na podstawie indeksu
                elevationItem.style.backgroundColor = itemColor;

                // Tworzenie div dla informacji o dystansie
                const infoDiv = document.createElement("div");
                infoDiv.className = "elevation-info";
                infoDiv.style.height = `${profileHeight}px`
                infoDiv.innerHTML = `<div class="route">trasa ${index + 1}</div>
                                    <div class="distance">DYSTANS:
                                    <div class="number">${totalDistance} km</div>`;
                elevationItem.appendChild(infoDiv);

                // Tworzenie div dla profilu
                const elevationDiv = document.createElement("div");
                elevationDiv.className = "elevation-profile";
                elevationDiv.id = `elevation-profile-${index}`;
                elevationDiv.style.height = `${profileHeight}px`
                elevationItem.appendChild(elevationDiv);


                // Dodanie całego elementu do kontenera
                document.getElementById("elevations-container").appendChild(elevationItem);

                // Rysowanie wykresu za pomocą Plotly
                Plotly.newPlot(elevationDiv.id, [
                    {
                        x: distances,
                        y: elevations,
                        type: 'scatter',
                        mode: 'lines',
                        line: {
                            color: '#F5A342',
                            shape: 'spline', // Ustawienie interpolacji (spline = smooth)
                            smoothing: 50, // Wyższa wartość oznacza bardziej wygładzony wykres
                            width: 2
                        },
                        fill: 'tozeroy', // Wypełnienie pod wykresem
                        fillcolor: 'rgba(249, 177, 102, 0.5)', // Kolor wypełnienia
                    }
                ], {
                    margin: {t: 10, b: 40, l: 40, r: 10},
                    xaxis: {
                        title: false,
                        showgrid: false,
                        zeroline: false,
                        color: "#FFFFFF",
                        linecolor: "#FFFFFF",
                        tickcolor: "#FFFFFF",
                        linewidth: 1.5, // Grubość osi
                        ticklen: 8,

                    },
                    yaxis: {
                        title: false,
                        zeroline: false,
                        range: [Math.min(...elevations) - 10, Math.max(...elevations) + 20],
                        color: "#FFFFFF",
                        linecolor: "#FFFFFF",
                        tickcolor: "#FFFFFF",
                        linewidth: 1.5, // Grubość osi
                        ticklen: 5,
                        showgrid: true, // Włączenie siatki poziomej
                        gridcolor: "rgba(255, 255, 255, 0.2)", // Lekki biały kolor dla siatki
                        gridwidth: 1, // Cienka linia siatki
                    },
                    plot_bgcolor: "rgba(51, 51, 51, 1)",
                    paper_bgcolor: "rgba(51, 51, 51, 0.8)",
                    font: {color: "#FFFFFF"}
                }, {
                    displayModeBar: false
                });

            })}
        const elevationProfiles = document.querySelectorAll('.elevation-item');

        hideLoader('elevation-loader');
        console.log(markers)
        setupInteractivity(elevationProfiles, routes, borders, markers);

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch został anulowany.');
                abortController = null; // Resetowanie kontrolera po zakończeniu
            } else {
                console.error('Błąd podczas fetch:', error);
            }
        } finally {
            hideLoader('elevation-loader');
            abortController = null; // Resetowanie kontrolera po zakończeniu
        }
}