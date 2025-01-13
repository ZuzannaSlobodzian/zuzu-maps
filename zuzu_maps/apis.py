import json
import requests


class GraphhopperAPIView:
    BASE_URL = "https://graphhopper.com/api/1/route"
    API_KEY = "347c2e03-7ffd-4dc1-87f5-dd9a9d678cfd"

    def __init__(self, profile="bike"):
        self.profile = profile

    def create_route_json(self, trip_number, points):
        filename = "trip" + str(trip_number) + ".boundary"

        body = {
            "profile": "bike",
            "points": points,
            "snap_preventions": [
                "motorway",
                "trunk",
                "tunnel"
            ],
        }
        headers = {"Content-Type": "application/json"}
        query = {"key": self.API_KEY}

        response = requests.post(self.BASE_URL, json=body, headers=headers, params=query)
        data = response.json()

        with open(f'zuzu_maps\\route_jsons\\{filename}', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)


class OpenElevationApi:
    BASE_URL = "https://api.open-elevation.com/api/v1/lookup"
    CHUNK_SIZE = 100  # Number of points per request

    @staticmethod
    def get_elevations(locations):
        elevations = []

        for i in range(0, len(locations), OpenElevationApi.CHUNK_SIZE):
            chunk = locations[i:i + OpenElevationApi.CHUNK_SIZE]
            try:
                payload = {"locations": [{"latitude": lat, "longitude": lng} for lat, lng in chunk]}
                response = requests.post(OpenElevationApi.BASE_URL, json=payload)

                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])

                    for result in results:
                        elevation = result.get("elevation", None)
                        elevations.append(elevation)
                else:
                    response.raise_for_status()
            except requests.RequestException as e:
                print(f"Error communicating with Open Elevation API: {e}")
                elevations.extend([None] * len(chunk))

        return elevations
