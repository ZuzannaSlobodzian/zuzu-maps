import os
import json
import logging
from rest_framework import status
from .apis import OpenElevationApi
from .services import RouteService
from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response


def website_view(request):
    return render(request, "website.html")


class TripView(APIView):
    @staticmethod
    def calculate_road_class_proportions(data):
        total_distance = data["paths"][0]["distance"]
        road_classes = data["paths"][0]["details"]["road_class"]
        road_class_distances = {}

        for start, end, road_class in road_classes:
            segment_length = end - start
            if road_class in road_class_distances:
                road_class_distances[road_class] += segment_length
            else:
                road_class_distances[road_class] = segment_length

        raw_proportions = {
            road_class: (distance / total_distance) * 100
            for road_class, distance in road_class_distances.items()
        }

        rounded_proportions = {
            road_class: round(proportion, 2)
            for road_class, proportion in raw_proportions.items()
        }

        total_rounded = sum(rounded_proportions.values())
        correction = 100 - total_rounded
        if correction != 0:
            max_key = max(raw_proportions, key=lambda k: raw_proportions[k] - rounded_proportions[k])
            rounded_proportions[max_key] += round(correction, 2)

        sorted_proportions = dict(
            sorted(rounded_proportions.items(), key=lambda item: item[1], reverse=True)
        )

        return sorted_proportions

    @staticmethod
    def decode_polyline(encoded, precision=1e5):
        coordinates = []
        index = 0
        lat = 0
        lng = 0
        length = len(encoded)

        while index < length:
            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            dlat = ~(result >> 1) if (result & 1) else (result >> 1)
            lat += dlat

            shift = 0
            result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            dlng = ~(result >> 1) if (result & 1) else (result >> 1)
            lng += dlng

            coordinates.append((lat / precision, lng / precision))

        return coordinates

    def recalculate_json(self):
        route_json_path = os.path.join(os.getcwd(), "zuzu_maps\\route_jsons")

        all_points = []
        distances_list = []

        for file_name in os.listdir(route_json_path):
            if file_name.endswith(".json"):
                with open(os.path.join(route_json_path, file_name), "r", encoding="utf-8") as json_file:
                    data = json.load(json_file)
                    distances_list.append(round((data["paths"][0]["distance"] / 1000), 2))
                    encoded_polyline = data["paths"][0]["points"]
                    decoded_points = self.decode_polyline(encoded_polyline)
                    all_points.append(decoded_points)

        return all_points, distances_list

    @staticmethod
    def add_elevation(points):
        updated_points = []

        for route in points:
            coordinates = [(point[0], point[1]) for point in route]
            elevations = OpenElevationApi.get_elevations(coordinates)

            coordinates_with_elevation = [
                [lat, lng, elevation] for (lat, lng), elevation in zip(coordinates, elevations)
            ]
            updated_points.append(coordinates_with_elevation)

        return updated_points

    def get(self, request):
        try:
            start_lat = request.query_params.get("start-lat")
            start_lng = request.query_params.get("start-lng")
            trip_distance = request.query_params.get("trip-distance")
            place_types = request.query_params.get("type-filter", "").split(",")

            if "all" in place_types:
                place_types = ["all"]

            start_lat = float(start_lat)
            start_lng = float(start_lng)
            trip_distance = int(trip_distance)

            trip_service = RouteService(start_lat, start_lng, trip_distance, place_types)

            all_place_points = trip_service.generate_trip_sequence()
            all_points, distance_list = self.recalculate_json()

            path_route_json = f"zuzu_maps\\route_jsons\\"
            for file_name in os.listdir(path_route_json):
                file_path = os.path.join(path_route_json, file_name)
                os.remove(file_path)

            return Response({
                "points": all_points,
                "places": all_place_points,
                "distances": distance_list
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Error in TripView: {str(e)}")

            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        json_data = request.data
        points = json_data.get("points", [])

        points_with_elevation = self.add_elevation(points)

        json_data["points"] = points_with_elevation

        return JsonResponse({
            "points": json_data["points"],
            "places": json_data.get("places", []),
            "distances": json_data.get("distances", [])
        }, status=200)
