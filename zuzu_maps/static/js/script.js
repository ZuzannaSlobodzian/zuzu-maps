 const map = L.map('map').setView([50.061485, 19.937978], 13); // Kraków

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        let startCoords = null;
        let selectedFilters = [];
        let lastMarker = null;
        let setTrip = true;

        function showLoader(loaderId) {
            document.getElementById(loaderId).style.display = 'flex';
        }

        function hideLoader(loaderId) {
            document.getElementById(loaderId).style.display = 'none';
        }

        let activePolyline = null; // Przechowuje aktywną trasę
        let activeProfile = null; // Przechowuje aktywny profil wysokościowy


    // Funkcja podświetlająca trasę i profil
   function highlightRouteAndProfile(index) {
    resetAll(); // Zresetuj stan początkowy

    routes.forEach((route, i) => {
        const pathElement = route._path; // Bezpośredni dostęp do ścieżki Leaflet

        if (i === index) {
            // Wyróżniona trasa
            route.setStyle({ weight: 6 }); // Zwiększ szerokość
            pathElement.classList.add('highlighted-route'); // Dodaj podświetlenie
        } else {
            // Rozmyta trasa
            route.setStyle({ weight: 4 }); // Zmniejsz szerokość
            pathElement.classList.add('blurred-route'); // Dodaj rozmycie i przezroczystość
        }
    });

    // Podświetlenie profilu
    elevationProfiles.forEach((profile, i) => {
        if (i === index) {
            profile.classList.add('highlighted');
            profile.classList.remove('blurred');
        } else {
            profile.classList.add('blurred');
            profile.classList.remove('highlighted');
        }
    });
}

function resetAll() {
    routes.forEach(route => {
        const pathElement = route._path;
        route.setStyle({ weight: 4 }); // Domyślna szerokość
        pathElement.classList.remove('blurred-route', 'highlighted-route');
    });

    elevationProfiles.forEach(profile => {
        profile.classList.remove('blurred', 'highlighted');
    });
}


function setupInteractivity(routes, elevationProfiles, map) {
    // Kliknięcie na trasę
    routes.forEach((route, index) => {
        route.on('click', () => {
            highlightRouteAndProfile(index);
        });
    });

    // Kliknięcie na profil
    elevationProfiles.forEach((profile, index) => {
        profile.addEventListener('click', () => {
            highlightRouteAndProfile(index);
        });
    });

    // Kliknięcie na mapę
    map.on('click', resetAll);
}



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
    // const colorPalette = ['#5f8aee', '#a25fac', '#808000', '#981e1d', '#c9a227', '#8d6f61'];
    const colorPalette = ['#A28834', '#2D680D', '#6eaaBE', '#702963', '#2E5894'];

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
        showLoader('route-loader');

        // Budowanie adresu URL do API z parametrami

        const apiUrl = `trip?start_lat=${startCoords.lat}&start_lng=${startCoords.lng}&trip_distance=${trip_distance}&type_filter=${typeFilter.join(',')}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            // const response = await fetch(`/static/mock.json?v=${new Date().getTime()}`);
            //
            // // const response = await fetch('/static/mock.json');
            // if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        var data = await response.json();
        const profileHeight = Math.max(100, window.innerHeight / data.points.length); // Dynamiczna wysokość


        console.log("API Response:", data);

const routes = [];
                // Rysowanie tras i profili wysokości
                data.points.forEach((route, index) => {
                    if (Array.isArray(route) && route.length > 1) {
                        const latLngs = route.map(point => [point[0], point[1]]);

                        // Wybieranie koloru z palety (cykliczne użycie kolorów)
                        const color = colorPalette[index % colorPalette.length];

                        // Czarna obramówka (thin background polyline for contrast)
                        L.polyline(latLngs, { color: 'black', weight: 6, opacity: 0.7 }).addTo(map);

                        // Właściwa trasa w kolorze z palety
                        const polyline = L.polyline(latLngs, { color: color, weight: 4, interactive: true, opacity: 1 }).addTo(map);
                        routes.push(polyline);


                                // Dodawanie danych do kontrolki


                    }
                });

            // Dodawanie popupów
                map.removeLayer(lastMarker);
                lastMarker = L.marker([startCoords.lat.toFixed(5), startCoords.lng.toFixed(5)], {icon: orangeIcon}).addTo(map)

                if (data.places) {
                    data.places.forEach(placeGroup => {
                        placeGroup.forEach(place => {
                            if (place.latitude && place.longitude) {

                                L.marker([place.latitude, place.longitude], { icon: blackIcon }).addTo(map)
                                            .bindPopup(`
                                            <div class="popup-container">
                                                <div class="popup-name">${place.name}</div>
                                                        <img src="/static/images/${place.image}.jpg" alt="${place.name} " class="popup-image">
                                                    <div class="popup-description">${place.description}</div>
                                            </div>
                                        `);

                        }
                        });
                    });
                }
                        hideLoader('route-loader');
        showLoader('elevation-loader');

        const elevationResponse = await fetch(`/zuzu_maps/trip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ points: data.points })
        });

        const withElevationData = await elevationResponse.json(); // Konwersja odpowiedzi do JSON
        console.log("API Response:", withElevationData);

    if (withElevationData.points) {
        withElevationData.points.forEach((route, index) => {
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
    setupInteractivity(routes, elevationProfiles, map);



    }

    // Obsługa przycisku
    document.getElementById("confirm-btn").addEventListener("click", function () {
        const trip_distance = document.getElementById("trip_distance").value;

        loadRoute(trip_distance, selectedFilters);
    });