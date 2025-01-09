from django.db import models


class PlaceModel(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    type = models.CharField(max_length=40)
    image = models.CharField(max_length=50)
    description = models.TextField()

    def __str__(self):
        return self.name
