# ZuzuMaps
## The web application for planning cycling trips around Krakow and the surrounding area.
The primary target audience of ZuzuMaps includes users looking to organize recreational cycling trips in the Krakow area. If you want to go on a Sunday bike trip, you want to start and end the trip in the same location, most likely your home.  Also, it would be great if the application could suggest interesting places to visit along the route.

For the above reasons the application fulfills two main goals: the routes are designed as loops with parameters specified by the user, and they are planned to include interesting places to visit. As part of route customization, the user can specify the starting point of the trip, input the expected route length, and select categories of places they wish to visit along the way. For the purpose of the application, a custom algorithm was developed to select points of interest, determining which locations and in what order should be positioned in a route.

The database includes diverse places such as viewpoints (for example Krakow’s mounds), parks, forests, architectural sites and lakes with swimming spots accessible in summer. Some of them are quite popular such as Zakrzówek or the Benedictine Abbey in Tyniec, but some places you can find fresh as lesser-known spots like the Grzybowska Valley.

Additionally, each point of interest is represented on the map with a pin and a pop-up containing a brief description and a photo. Elevation profiles are also generated to help users assess the potential challenges of the route.

### Technologies
* Django
* PostgreSQL
* GraphHopper API
* Open-Elevation API
* JavaScript, HTML, CSS

### Features
* customization of loops by specifying expected route length and choosing the start location
* selection of  preferred categories of places to visit
* Multiple suggestions of diverse loops in entered parameters
* pop-ups with brief description and a photo of points to visit along the route
* elevation profiles of the routes
* highlighting the selected route and profile

### Screenshots

![Screenshot 2025-01-18 151021](https://github.com/user-attachments/assets/cbf469a4-19f9-4634-982a-93435b13671f)

![Screenshot 2025-01-18 150936](https://github.com/user-attachments/assets/e84bd655-fa41-4322-b9c4-9fccf1d8edc8)

![Screenshot 2025-01-18 151516](https://github.com/user-attachments/assets/2b176f9e-2ace-4435-8488-74cca8a32568)

![Screenshot 2025-01-18 151543](https://github.com/user-attachments/assets/18ae69a1-b78e-40b3-ae6b-3b83ca8fe009)
