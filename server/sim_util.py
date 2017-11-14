## TODO utility functions for the simulation
from geopy.distance import great_circle
from time import strptime
from collections import deque
import datetime
import random
import math


def center_of(bounds):
    raise(NotImplementedError)


def ll_dist_m(a, b):
    return great_circle(a, b).meters


def timeify(s):
    return strptime(s, "%m/%d/%y %I:%M %p")


def seconds_since_midnight(time):
    if type(time) is int:
        return time
    return int(datetime.timedelta(
        hours=time.hour, minutes=time.minute,
        seconds=time.second).total_seconds())


def default_json(o):
    return o.__dict__


def generate_circle(longitude, latitude, max_radius, no_trips=3):
    " generates circle around a point, then "
    " returns endloc list of (long,lat) end locations"
    # radius def 1
    number_of_trips = random.randrange(5, 10)

    endlocs = []

    for i in range(no_trips):
        angle = 2 * math.pi * random.random()  # n(0 - 2pi)
        random_radius = random.uniform(0, max_radius)

        # calc coorindates
        end_long = (random_radius * math.cos(angle)) + longitude
        end_lat = (random_radius * math.sin(angle)) + latitude

        endlocs.append((end_long, end_lat))

    return endlocs




# generate circle. then random generated number of locations within circle
