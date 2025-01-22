import json
import requests


class GraphhopperAPIView:
    BASE_URL = "https://graphhopper.com/api/1/route"

    def __init__(self):
        try:
            with open("zuzu_maps\\credentials\\api_key.txt", "r") as file:
                self.api_key = file.read().strip()
        except FileNotFoundError:
            raise FileNotFoundError("404")

    def create_route_json(self, trip_number, points):
        filename = "trip" + str(trip_number) + ".json"

        body = {
            "profile": "bike",
            "points": points,
            "snap_preventions": [
                "motorway",
                "trunk",
                "tunnel"
            ]
        }
        headers = {
            "Content-Type": "application/json"
        }
        query = {
            "key": self.api_key
        }

        try:
            response = requests.post(self.BASE_URL, json=body, headers=headers, params=query)
            response.raise_for_status()

            data = response.json()
            with open(f"zuzu_maps\\route_jsons\\{filename}", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)

        except requests.RequestException:
            raise Exception("503")


class OpenElevationApi:
    BASE_URL = "https://api.open-elevation.com/api/v1/lookup"
    CHUNK_SIZE = 100

    @staticmethod
    def get_elevations(locations):
        elevations = []

        for i in range(0, len(locations), OpenElevationApi.CHUNK_SIZE):
            chunk = locations[i:i + OpenElevationApi.CHUNK_SIZE]
            try:
                payload = {
                    "locations": [{
                        "latitude": lat,
                        "longitude": lng} for lat, lng in chunk]
                }
                response = requests.post(OpenElevationApi.BASE_URL, json=payload)
                response.raise_for_status()

                data = response.json()
                results = data.get("results", [])

                for result in results:
                    elevation = result.get("elevation", None)
                    elevations.append(elevation)

            except requests.RequestException:
                elevations.extend([None] * len(chunk))

        return elevations
