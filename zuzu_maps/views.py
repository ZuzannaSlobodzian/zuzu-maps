from .apis import OpenElevationApi
from .services import RouteService
import os
import json
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.http import JsonResponse
from asgiref.sync import sync_to_async

# views.py
from django.shortcuts import render

def website_view(request):
    return render(request, 'website.html')  # Zwróć plik website.html



class TripView(APIView):

    def calculate_road_class_proportions(self, data):
        total_distance = data['paths'][0]['distance']

        road_classes = data['paths'][0]['details']['road_class']

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

    def decode_polyline(self, encoded, precision=1e5):
        """Decode a polyline and add elevations."""
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

        # Fetch elevations for all coordinates
        # elevations = OpenElevationApi.get_elevations(coordinates)
        # print(elevations)
        #
        # # Combine coordinates with elevations
        # coordinates_with_elevation = [
        #     [lat, lng, elevation] for (lat, lng), elevation in zip(coordinates, elevations)
        # ]


        # return coordinates_with_elevation

        return coordinates

    def recalculate_json(self):
        # Ścieżka do folderu z JSON-ami
        route_json_path = os.path.join(os.getcwd(), "zuzu_maps\\route_jsons")

        # Przechowuje wynikowe punkty
        all_points = []
        distances_list = []

        print(route_json_path)
        for file_name in os.listdir(route_json_path):
            if file_name.endswith('.json'):
                with open(os.path.join(route_json_path, file_name), 'r', encoding='utf-8') as json_file:
                    data = json.load(json_file)

                    distances_list.append(round((data['paths'][0]['distance']/1000), 2))
                    # road_list = self.calculate_road_class_proportions(data)
                    # print(road_list)
                    # Zakładamy, że dane zawierają klucz "polyline"
                    encoded_polyline = data['paths'][0]['points']
                    print("mmmmm")
                    if encoded_polyline:
                        print("mamy")
                        decoded_points = self.decode_polyline(encoded_polyline)
                        all_points.append(decoded_points)
        return all_points, distances_list
    def add_elevation(self, points):
        updated_points = []


        for route in points:
            # Pobierz tylko współrzędne [lat, lng] dla każdej trasy
            coordinates = [(point[0], point[1]) for point in route]

            # Pobierz wysokości dla wszystkich współrzędnych
            elevations = OpenElevationApi.get_elevations(coordinates)

            # Połącz współrzędne z wysokościami
            coordinates_with_elevation = [
                [lat, lng, elevation] for (lat, lng), elevation in zip(coordinates, elevations)
            ]

            # Dodaj trasę z uzupełnionymi punktami
            updated_points.append(coordinates_with_elevation)

        return updated_points

    def get(self, request):
        # Pobranie parametrów z zapytania
        start_lat = request.query_params.get('start_lat')
        start_lng = request.query_params.get('start_lng')
        trip_distance = request.query_params.get('trip_distance')
        place_types = request.query_params.get('type_filter', '').split(',')

        if not all([start_lat, start_lng, trip_distance]):
            return Response({"error": "Brak wymaganych parametrów"}, status=status.HTTP_400_BAD_REQUEST)

        # Konwersja parametrów do odpowiednich typów
        start_lat = float(start_lat)
        start_lng = float(start_lng)
        trip_distance = float(trip_distance)

        # Inicjalizacja serwisu TripService
        trip_service = RouteService(start_lat, start_lng, trip_distance, place_types)

        # Generowanie sekwencji trasy
        all_place_points = trip_service.generate_trip_sequence()

        all_points, distance_list = self.recalculate_json()

        path_route_json = f'zuzu_maps\\route_jsons\\'
        for file_name in os.listdir(path_route_json):
            file_path = os.path.join(path_route_json, file_name)
            os.remove(file_path)

        # with open(f'zuzu_maps\\static\\mock.json', 'w', encoding='utf-8') as f:
        #     json.dump({"points": all_points, "places": all_place_points, "distances": distance_list}, f, ensure_ascii=False, indent=4)
        # # Zwracanie punktów jako JSON
        return Response({"points": all_points, "places": all_place_points, "distances": distance_list}, status=status.HTTP_200_OK)

    def post(self, request):
        json_data = request.data
        points = json_data.get('points', [])
        print(points)
        print("#####################")

        # 2. Obliczanie wysokości (drugi etap)
        all_points = self.add_elevation(points)
        print(all_points)

        json_data['points'] = all_points
        # Zapisz wyniki
        # with open(f'zuzu_maps\\static\\mock.json', 'w', encoding='utf-8') as f:
        #     json.dump({"points": all_points, "distances": distance_list}, f, ensure_ascii=False, indent=4)

        return JsonResponse({
            "points": json_data['points'],
            "places": json_data.get('places', []),
            "distances": json_data.get('distances', [])
        }, status=200)