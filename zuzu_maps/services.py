# utils/trip.py
import numpy as np
from geopy.distance import geodesic

from .apis import GraphhopperAPIView
from .models import PlaceModel

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
        return distance < (self.trip_distance / 2) - 1

    def points_preselection(self, points):
        print(self.place_types)

        for row in points:
            # Filtruj po odległości i sprawdzaj, czy typ miejsca spełnia kryteria
            if self.start_point_distances(row.latitude, row.longitude):
                if "all" in self.place_types or row.type in self.place_types:
                    self.close_points_list.append(row)

        if not self.close_points_list:
            raise Exception("Brak dostatecznej ilości punktów z tej kategorii w podanym zasięgu.")

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
        print(points)
        return points

    def calculate_distance_matrix(self, points):
        distance_matrix = np.array([[round(geodesic((n.latitude, n.longitude), (m.latitude, m.longitude)).kilometers, 3) if geodesic((n.latitude, n.longitude), (m.latitude, m.longitude)) > 0 else -1 for n in points] for m in points])

        return distance_matrix

    def generate_trip_sequence(self):
        points = PlaceModel.objects.all()
        self.points_preselection(points)

        for i in range(0, 5):

            distance_matrix = self.calculate_distance_matrix(self.close_points_list)
            start_threshold = max(distance_matrix[:, 0])
            column_index = np.argwhere(distance_matrix[:, 0] == start_threshold)[0][0]

            self.visited_list = [distance_matrix[column_index, 0]]
            self.indexes_list = [column_index]

            if distance_matrix[0, column_index] + distance_matrix[0, column_index] < self.trip_distance:
                counter = self.visited_list[0]

                for j in range(3):
                    if sum(distance_matrix[:, column_index]) > -1:
                        point_x = sorted(value for value in set(distance_matrix[:, column_index]) if value != -1)[0]
                    else:
                        break
                    counter = counter + point_x

                    if counter + distance_matrix[0, column_index] > self.trip_distance or j == 2:
                        self.visited_list.append(distance_matrix[0, column_index])
                        break

                    old_column_index = column_index
                    column_index = np.argwhere(distance_matrix[:, column_index] == point_x)[0][0]

                    self.visited_list.append(distance_matrix[old_column_index, column_index])
                    self.indexes_list.append(column_index)
                    for k in range(len(self.indexes_list) - 1):
                        distance_matrix[self.indexes_list[k], column_index] = -1

            api = GraphhopperAPIView()
            api.create_route_json(i, self.calculate_points_to_json())

            for l in self.indexes_list:
                print(self.close_points_list[l])

            current_list = []
            for l in self.indexes_list:
                serialized_data = PlaceModelSerializer(self.close_points_list[l]).data
                current_list.append(serialized_data)

            self.all_place_points.append(current_list)

            self.indexes_list = sorted(self.indexes_list, reverse=True)
            for l in self.indexes_list:
                self.close_points_list.pop(l)

            if sum(self.visited_list) < (self.trip_distance - 10):
                print(sum(self.visited_list))
                break

        return self.all_place_points



from rest_framework import serializers
from .models import PlaceModel

class PlaceModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceModel
        fields = ['id', 'name', 'latitude', 'longitude', 'type', 'image', 'description']


