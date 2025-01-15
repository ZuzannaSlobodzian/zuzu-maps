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
        return distance < (self.trip_distance / 2)

    def points_preselection(self, points):
        print(self.place_types)

        for row in points:
            # Filtruj po odległości i sprawdzaj, czy typ miejsca spełnia kryteria
            if self.start_point_distances(row.latitude, row.longitude):
                if "all" in self.place_types or row.type in self.place_types:
                    self.close_points_list.append(row)

        print(self.close_points_list)
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
        print(points)
        return points

    def calculate_distance_matrix(self, latitudes, longitudes):

        # print(latitudes)
        # print(longitudes)

        points = list(zip(latitudes, longitudes))
        print(points)

        distance_matrix = np.array(
            [[round(geodesic(n, m).kilometers, 3) if n != m else 0 for m in points] for n in points])

        print(distance_matrix)

        return distance_matrix

    def generate_trip_sequence(self):
        points = PlaceModel.objects.all()
        self.points_preselection(points)

        # print("to są latitudes")
        # print(latitudes)

        for i in range(0, 5):
            latitudes = [point.latitude for point in self.close_points_list]
            longitudes = [point.longitude for point in self.close_points_list]

            latitudes.insert(0, self.start_latitude)
            longitudes.insert(0, self.start_longitude)

            distance_matrix = self.calculate_distance_matrix(latitudes, longitudes)
            start_threshold = max(distance_matrix[:, 0])
            column_index = np.argwhere(distance_matrix[:, 0] == start_threshold)[0][0]

            self.visited_list = [distance_matrix[0, column_index]]
            self.indexes_list = [column_index - 1]

            print("column index:")
            print(column_index)
            print(self.visited_list)

            #ten if nie jest potrzebny bo wiemy że spełnia założenia
            if distance_matrix[0, column_index] + distance_matrix[0, column_index] < self.trip_distance:
                counter = self.visited_list[0]
                print("weszlo do dodawania punktow")
                for j in range(3):
                    if sum(distance_matrix[1:, column_index]) > 0:  #zmienić na 0 i suma column_index
                        print("dodajemy punkcik")
                        point_x = sorted(value for value in set(distance_matrix[1:, column_index]) if value != 0)[0]
                    else:
                        print("nie dodajemy nic")
                        self.visited_list.append(distance_matrix[0, column_index])
                        break
                    print("punkt_x")
                    print(point_x)
                    counter = counter + point_x

                    old_column_index = column_index
                    column_index = np.argwhere(distance_matrix[:, column_index] == point_x)[0][0]

                    print("nowy column_index")
                    print(column_index)

                    #tu żle tu liczymy od nowego column_index
                    if counter + distance_matrix[0, column_index] > self.trip_distance or j == 2:
                        print("za długa trasa")
                        print(counter + distance_matrix[0, column_index])
                        self.visited_list.append(distance_matrix[0, old_column_index])
                        break

                    self.visited_list.append(distance_matrix[column_index, old_column_index])
                    self.indexes_list.append(column_index - 1)

                    #to też dziwne
                    # for k in range(len(self.indexes_list) - 1):
                    #     distance_matrix[self.indexes_list[k], column_index] = -1
                    distance_matrix[old_column_index, column_index] = 0
                    print(distance_matrix)



            print("indexes_list po skompletowaniu trasy")
            print(self.indexes_list)
            print(sum(self.visited_list))
            if sum(self.visited_list) < (self.trip_distance * 0.7):
                print(sum(self.visited_list))
                break
            api = GraphhopperAPIView()
            api.create_route_json(i, self.calculate_points_to_json())

            for l in self.indexes_list:
                print(self.close_points_list[l])

            current_list = []
            for l in self.indexes_list:
                serialized_data = PlaceModelSerializer(self.close_points_list[l]).data
                current_list.append(serialized_data)

            self.all_place_points.append(current_list)
            print(current_list)

            self.indexes_list = sorted(self.indexes_list, reverse=True)
            # longitudes = sorted(longitudes, reverse=True)
            # latitudes = sorted(latitudes, reverse=True)

            for l in self.indexes_list:
                self.close_points_list.pop(l)
                # longitudes.pop(l)
                # latitudes.pop(l)

            print(self.close_points_list)
            # if len(self.close_points_list) == 1:
            #     break



        print(self.all_place_points)

        if self.all_place_points == []:
            raise Exception("444")
        return self.all_place_points


from rest_framework import serializers
from .models import PlaceModel


class PlaceModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceModel
        fields = ['id', 'name', 'latitude', 'longitude', 'type', 'image', 'description']
