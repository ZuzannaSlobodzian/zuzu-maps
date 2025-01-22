import numpy as np
from django.http import JsonResponse

from .models import PlaceModel
from geopy.distance import geodesic
from .apis import GraphhopperAPIView
from rest_framework import serializers


class RouteService:
    def __init__(self, start_latitude, start_longitude, trip_distance, place_types):
        self.start_latitude = start_latitude
        self.start_longitude = start_longitude
        self.trip_distance = trip_distance
        self.place_types = place_types
        self.close_points_list = []
        self.indexes_list = []
        self.visited_list = []
        self.all_place_points = []

    def start_point_distances(self, lat, long):
        distance = geodesic((self.start_latitude, self.start_longitude), (lat, long)).kilometers

        return distance < (self.trip_distance / 2)

    def points_preselection(self, points):
        for row in points:
            if self.start_point_distances(row.latitude, row.longitude):
                if "all" in self.place_types or row.type in self.place_types:
                    self.close_points_list.append(row)

        if not self.close_points_list:
            raise Exception("444")

    def calculate_points_to_json(self):
        points = [
            [self.start_longitude, self.start_latitude]
        ]

        for i in range(len(self.indexes_list)):
            points.append([
                self.close_points_list[self.indexes_list[i]].longitude,
                self.close_points_list[self.indexes_list[i]].latitude
            ])

        points.append([self.start_longitude, self.start_latitude])

        return points

    @staticmethod
    def calculate_distance_matrix(latitudes, longitudes):
        points = list(zip(latitudes, longitudes))

        distance_matrix = np.array([
            [round(geodesic(n, m).kilometers, 3) if n != m else 0 for m in points] for n in points
        ])

        return distance_matrix

    def generate_trip_sequence(self):
        api = GraphhopperAPIView()

        points = PlaceModel.objects.all()
        self.points_preselection(points)

        for i in range(0, 5):
            latitudes = [point.latitude for point in self.close_points_list]
            longitudes = [point.longitude for point in self.close_points_list]

            latitudes.insert(0, self.start_latitude)
            longitudes.insert(0, self.start_longitude)

            distance_matrix = self.calculate_distance_matrix(latitudes, longitudes)

            start_threshold = max(distance_matrix[:, 0])
            column_index = np.argwhere(distance_matrix[:, 0] == start_threshold)[0][0]

            if column_index == 0:
                break

            self.visited_list = [distance_matrix[0, column_index].item()]
            self.indexes_list = [column_index.item() - 1]

            for j in range(3):
                if sum(distance_matrix[1:, column_index]) > 0:
                    point_x = sorted(value for value in set(distance_matrix[1:, column_index]) if value != 0)[0]
                else:
                    self.visited_list.append(distance_matrix[0, column_index].item())
                    break

                old_column_index = column_index
                column_index = np.argwhere(distance_matrix[:, column_index] == point_x)[0][0]

                if sum(self.visited_list) + point_x + distance_matrix[0, column_index] > self.trip_distance or j == 2:
                    self.visited_list.append(distance_matrix[0, old_column_index].item())
                    break

                self.visited_list.append(point_x.item())
                self.indexes_list.append(column_index.item() - 1)

                distance_matrix[old_column_index, column_index] = 0

            if sum(self.visited_list) < (self.trip_distance * 0.7):
                break

            api.create_route_json(i, self.calculate_points_to_json())

            current_list = []
            for k in self.indexes_list:
                serialized_data = PlaceModelSerializer(self.close_points_list[k]).data
                current_list.append(serialized_data)
            self.all_place_points.append(current_list)

            self.indexes_list = sorted(self.indexes_list, reverse=True)

            for k in self.indexes_list:
                self.close_points_list.pop(k)

        if not self.all_place_points:
            raise Exception("444")

        return self.all_place_points


class PlaceModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceModel
        fields = ["id", "name", "latitude", "longitude", "type", "image", "description"]
