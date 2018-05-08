''' Fernando Sanchez, August 2017 '''

import math
import csv
import random
import json
import requests
import numpy as np
import os

"""
NOTES FOR THE READER:

VOCABULARY:
- car: a PEV
- trip: any distinct movement of a car
- request: a trip specifically for picking up a person/parcel (TODO: have this format reflected in the inheritance of the objects i.e. make a Trip object as the super parent)
- navigation: the trip a car takes to pick up a request
- rebalance: a trip a car takes to move to where it believes the next request will be
- idle: 'trip' where the car sits idle in one position
- RebalanceData object: this data structure holds a set of clusters (using k-means clustering) for the rebalancing procedure
- req: I didn't decide on the above framework until most of the logic was written so I use 'req' and 'request' to describe arbitrary trips in addition to real requests
- pushtime: amount of waittime caused by not having enough vehicles
- kind: kind of request (passenger or parcel)
- movingtime: amount of time the car spends moving (not idle)
- utiltime: amount of time a car is moving while carrying a passenger or parcel

LOGIC:
1. generate requests and empty arrays for storing completed requests/trips
    - heapify request list by earliest start time
2. initialize Rebalancing data structure
3. generate cars and empty arrays for storing cars in various states
4. while there are still requests to fulfill
    - update the position of rebalancing cars using time elapsed
    - update busy cars to free up any potentially finished trips
    - assign closest 'free' (meaning idle or rebalancing) car to claim request
        - if there are no 'free' cars then push the request time forward
    - rebalance procedure
        - TODO: fix and describe this logic
5. once all requests have been claimed finish the trips that are still ongoing
6. run data analytics
7. send results in JSON format visualizer
notes on logic:
- anytime cars/trips are removed or added to lists there is careful code to ensure the objects properly move and the data is kept track of
- comments on the coe itself give greater insight
- much of the code here is infrastructure for keeping track of data
- all of the simulation logic happens in realsim.py, none of it is here

FUTURE IDEAS:
- don't let cars that are too far away try to pick up someone, instead just wait for a closer car to finish its trip
- write to the JSON output in real time so the visualizer can display in real time
- implement charging stations and battery life for the cars
- implement a smarter rebalancing procedure
"""

"""
UTILITIES AND CLASSES FOR THE SIMULATOR
"""

LOCAL = True
API_BASE = 'http://0.0.0.0:5000/' if LOCAL else 'https://router.project-osrm.org/'


def get_osrm_output(start, end):
    '''
    get OSRM route finding output
    '''
    samp1 = 'route/v1/bicycle/'
    samp2 = '?alternatives=false&steps=true&geometries=polyline&overview=simplified&annotations=false'
    samp1 = samp1 + str(start[0]) + ',' + str(start[1]) + ';'
    samp2 = str(end[0]) + ',' + str(end[1]) + samp2
    sample = API_BASE + samp1+samp2
    x = requests.get(sample)
    return x.text


def get_snap_output(point):
    '''
    get OSRM nearest street position output
    '''
    samp1 = 'nearest/v1/bicycle/'
    samp2 = '?number=1'
    samp1 = samp1 + str(point[0]) + ',' + str(point[1])
    sample = API_BASE + samp1 + samp2
    x = requests.get(sample)
    return x.text


def find_snap_coordinates(s):
    '''
    find the closest snapped coordinate from an OSRM nearest output
    '''
    data = json.loads(s)
    coord = data["waypoints"][0]["location"]
    return [str(coord[0]), str(coord[1])]


def find_total_duration(s):
    '''
    Find the total travel time from an OSRM route output
    '''
    data = json.loads(s)
    time = 1000000
    if data["code"] == "Ok":
        time = (float(str(data["routes"][0]["duration"])))
    return time


def find_total_distance(s):
    '''
    Find total distance traveled from an OSRM route output
    '''
    data = json.loads(s)
    dis = 0
    if data["code"] == "Ok":
        dis = (float(str(data["routes"][0]["distance"])))
    return dis


def find_leg_loc(x, elapsed):
    '''
    Find the location of the leg of the trip we are on
    '''
    # print x
    time = 0.0
    final_data = {}
    data = json.loads(x)
    steps = data["routes"][0]["legs"][0]["steps"]
    i = 0
    for step in steps:
        duration = (float(str(step["duration"])))/60.0
        location = step["maneuver"]["location"]  # list [71.xxx, 42.xxx]
        final_data[i] = (duration, location)
        i += 1
    for j in range(i):
        if time >= elapsed:
            break
        else:
            time += final_data[j][0]
    temp = final_data[j][1]
    final = (str(temp[0]), str(temp[1]))
    return final  # return location of estimated step


class Request(object):

    def __init__(self, time, pickup, dropoff, origin="random", kind=None):
        '''
        time = time of request, pickup/dropoff in form of (lat, long)
        start/end = time of start/end of ride, complete = completion status
        '''
        self.origin = origin
        self.original_time = time
        self.time = time
        self.pickup = pickup
        self.dropoff = dropoff
        self.waittime = 0
        self.pushtime = 0  # jank fix to know how much of waittime comes from unavailability rather than travel times
        self.osrm = get_osrm_output(self.pickup, self.dropoff)
        self.traveltime = find_total_duration(self.osrm)
        self.traveldist = find_total_distance(self.osrm)
        self.kind = kind

    def __cmp__(self, other):
        ''' compare method for heap '''
        return cmp(self.time, other.time)

    def __repr__(self):
        ''' represent method for stuff '''
        return '[time: '+str(self.time)+', pickup: '+str(self.pickup)+', dropoff: '+str(self.dropoff)+']'

    def __str__(self):
        ''' to string funciton for printing '''
        return 'Print Method: time: '+str(self.time)+', pickup: '+str(self.pickup)+', dropoff: '+str(self.dropoff)


class Navigation(Request):

    def __init__(self, time, start, end):
        Request.__init__(self, time, start, end)


class Rebalance(Request):

    def __init__(self, time, start, end, cut_short=False):
        '''
        cut_short = whether this rebalancing trip was cut short to pickup a passenger
        '''
        Request.__init__(self, time, start, end)
        self.cut_short = cut_short


class Idle(Request):

    def __init__(self, start_time, loc):
        self.time = start_time
        self.original_time = start_time
        self.pickup = loc
        self.dropoff = loc  # all three of these are the same thing but under different names for homogeniety throughout the classes
        self.osrm = loc
        self.traveltime = None
        self.end_time = None

    def get_duration(self):
        self.traveltime = self.end_time-self.time


class Recharge(Request):

    def __init__(self, time, start, end, charge_time):
        Request.__init__(self, time, start, end)
        self.idle = Idle(self.time+self.traveltime, start)
        self.charge_time = charge_time


class PEV(object):

    def __init__(self, iden, pos, time=0):
        '''
        request = request being fulfilled
        pos = position if empty
        time = time of arrival if fulfilling request
        '''
        self.spawn = pos
        self.id = iden
        self.pos = pos
        self.request = Idle(time, self.pos)
        self.time = None
        self.movingtime = 0
        self.movingspace = 0
        self.c_movingspace = 0
        self.utiltime = 0
        self.idletime = 0
        self.nav = None

    def __cmp__(self, other):
        ''' compare method for heap '''
        return cmp(self.time, other.time)

    def low_power(self, c_dist):
        if abs(self.c_movingspace-c_range) >= c_dist:
            return True
        return False

    def create_nav(self):
        ''' create a navigation object '''
        nav = Navigation(self.request.time, self.pos, self.request.pickup)
        self.nav = nav

    def fulfill_request(self, request):
        ''' begin route towards request '''
        self.request = request
        self.create_nav()
        traveltime1 = self.nav.traveltime  # drive to pickup
        traveltime2 = self.request.traveltime  # drive to dropoff
        self.time = request.time + traveltime1 + traveltime2  # update time
        # update traveltime and utilization time for analytics
        self.movingtime += traveltime1+traveltime2
        self.movingspace += self.request.traveldist+self.nav.traveldist
        self.c_movingspace += self.request.traveldist+self.nav.traveldist
        self.utiltime += traveltime2
        # hold waittime for trip delivery
        self.request.waittime = traveltime1

    def fulfill_rebalance(self, rebalance):
        ''' begin route for a rebalance '''
        # it is assumed a rebalance has pickup = self.pos
        self.request = rebalance
        self.time = rebalance.traveltime

    def fulfill_recharge(self, recharge):
        ''' begin route to recharge station and idle there for set amount of time '''
        self.request = recharge
        self.time = self.request.idle.time+self.charge_time
        self.movingtime += self.request.traveltime
        self.movingspace += self.request.traveldist
        self.c_movingspace += self.request.traveldist

    def end_recharge(self):
        self.loc = self.request.dropoff
        temp = Recharge(self.request.time, self.request.pickup, self.request.dropoff, self.request.charge_time)
        temp_id = Idle(self.request.idle.time, self.request.idle.pickup)
        temp_id.end_time = temp_id.time+temp_id.charge_time
        temp_id.get_duration()
        self.become_idle(self.time, self.pos)
        self.time = None
        self.c_movingspace = 0
        return (temp, temp_id)

    def update_rebalance(self, request):
        # reroute car to new request
        self.fulfill_request(request)

    def become_idle(self, time):
        self.request = Idle(time, self.pos)

    def end_idle(self, req):
        temp = Idle(self.request.time, self.request.pickup)
        temp.end_time = req.time
        temp.get_duration()
        self.idletime += temp.traveltime
        if type(req) == Rebalance:
            self.fulfill_rebalance(req)  # could be rebalance or real request
        else:
            self.fulfill_request(req)
        return temp

    def end_trip(self):
        ''' update car when trip ends '''
        self.time = None
        self.pos = self.request.dropoff
        return (self.request, self.nav)

    def end_rebalance(self):
        ''' update car if trip ends '''
        self.time = None
        self.pos = self.request.dropoff
        return self.request


class RebalanceData():
    # object for maintaining cluster data

    def __init__(self, spreadsheet, k):
        '''
        Process data for clustering for rebalancing
        '''
        data1 = []
        for i in range(spreadsheet, spreadsheet+1):  # start with 1 spreadsheet of data (the last hour) and update with completed trips
            samp = 'Data/Hour_'+str(i)+'_100.csv'
            with open(samp, 'rb') as file:
                spamreader = csv.reader(file, delimiter=',', quotechar='|')
                for row in spamreader:
                    data1.append(row)
        self.points = []
        for row in data1:
            temp = [float(row[3]), float(row[4])]
            self.points.append(temp)
        self.means = []
        self.k = k

    # Lloyd's alg for k-means-clustering
    # credit to https://datasciencelab.wordpress.com/2013/12/12/clustering-with-k-means-in-python/
    def cluster(self):
        # associate each point with a cluster
        clusters = {}
        for x in self.points:
            bestmean = min([(i[0], np.linalg.norm([i-j for i, j in zip(list(x), list(self.means[i[0]]))])) for i in enumerate(self.means)], key=lambda t: t[1])[0]
            try:
                clusters[bestmean].append(x)
            except KeyError:
                clusters[bestmean] = [x]
        return clusters

    def reevaluate(self, clusters):
        # find new clusters
        new_means = []
        keys = sorted(clusters.keys())
        for k in keys:
            new_means.append(np.mean(clusters[k], axis=0))
        return new_means

    def has_converged(self, old_means):
        # check for convergence
        return (set([tuple(a) for a in self.means]) == set([tuple(a) for a in old_means]))

    def find_centers(self):
        # initialize
        oldmeans = random.sample(self.points, self.k)
        self.means = random.sample(self.points, self.k)
        # run until convergence
        while not self.has_converged(oldmeans):
            oldmeans = self.means
            clusters = self.cluster()
            self.means = self.reevaluate(clusters)
        return (self.means, clusters)


def dist(start, end):
    '''
    distance function given two lat/long pairs (as strings or floats), returns distance in meters
    '''
    one = (float(start[0]), float(start[1]))
    two = (float(end[0]), float(end[1]))
    lat1 = one[1]*math.pi/180.0
    lat2 = two[1]*math.pi/180.0
    latdel = (two[1]-one[1])*math.pi/180.0
    londel = (two[0]-one[0])*math.pi/180.0
    a = math.sin(latdel/2.0)**2 + math.cos(lat1)*math.cos(lat2)*(math.sin(londel/2.0))**2
    c = 2*math.atan2(a**.5, (1-a)**.5)
    d = 6371*1000*c
    # print d
    return d


def random_requests(location, ratio, pct, hrs):
    '''
    '''
    hours = hrs
    requests = []
    # percent random request every minute
    for time in range(0, hours*60):
        if random.randint(1, 100) > pct:
            continue
        kind = "Passenger"
        if random.randint(1, 100) > ratio:
            kind = "Passenger" #CHANGE BACK TO PARCEL
        start = gaussian_randomizer(location, 2)
        end = gaussian_randomizer(start, 2)
        start_point = find_snap_coordinates(get_snap_output(start))
        end_point = find_snap_coordinates(get_snap_output(end))
        req = Request(time*60, start_point, end_point, "random",  kind)
        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            requests.append(req)
    return requests


def populate_requests(num_spreadsheets, max_dist, ratio):
    '''
    Populate the requests list with Request objects from data sheets
    '''
    # extract data
    TOLERANCE = 50
    data = []
    ''' TODO: remove outlier origins that are very far away '''
    x = os.getcwd()
    pathing = x+"/Backend/Data/"
    for i in range(0, num_spreadsheets):
        samp = pathing+'Hour_'+str(i)+'_100.csv'
        with open(samp, 'rb') as file:
            spamreader = csv.reader(file, delimiter=',', quotechar='|')
            for row in spamreader:
                data.append(row)
    # create request objects
    requests = []
    for row in data:
        rng = random.randint(1, 100)
        kind = "Passenger"
        if rng > ratio:
            kind = "Parcel"
        pickup = [row[3], row[4]]
        dropoff = [row[7], row[8]]
        d = dist(pickup, dropoff)
        if d > max_dist or d < TOLERANCE:
            continue
        pretime = row[1][-8:-3]
        time_ = float(int(pretime[:2]) % 12)*60+float(int(pretime[3:]))
        if row[1][-2:] == "PM":
            time_ += 12.0*60.0
        req = Request(time_, pickup, dropoff, kind)
        requests.append(req)
    return requests


def parse_for_visualizer_steps(osrm):
    '''
    Parse an OSRM output to give steps polyline to the visualizer
    '''
    data = json.loads(osrm)
    steps = data["routes"][0]["legs"][0]["steps"]
    geometries = []
    for step in steps:
        geometries.append(step["geometry"])
    return geometries


def parse_for_visualizer_whole(osrm):
    '''
    Parse an OSRM output to give full polyline the visualizer
    '''
    data = json.loads(osrm)
    geometry = data["routes"][0]["geometry"]
    return geometry


def send_to_visualizer(data, filename):
    '''
    Write dictionary data to a file in JSON format
    '''
    curpath = os.path.dirname(os.path.abspath(__file__))
    new_path = curpath+"/Results/"+filename
    with open(new_path, 'w') as outfile:
        json.dump(data, outfile)


def gaussian_randomizer(location, distance):
    '''
    Pick a random point within X mile radius of location using gaussian distribution
    '''
    cov = [[.0001, 0], [0, .0001]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo

# TODO: make this .16 mile radius


def gaussian_randomizer_half_mile(location):
    '''
    Pick a random point within ~.5 mile radius of location using gaussian distribution
    '''
    cov = [[.000005, 0], [0, .000005]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo


def gaussian_randomizer_two_mile(location):
    '''
    Pick a random point within ~.5 mile radius of location using gaussian distribution
    '''
    cov = [[.00005, 0], [0, .00005]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo


def generate_japan_trips(month, day, year):
    '''
    data = []
    trips = []
    stations = {}
    curpath = os.path.dirname(os.path.abspath(__file__))
    with open(curpath+'/japan-data/stations.csv') as file:
        spamreader = csv.reader(file, dlimiter=',', quotechar='|')
        for row in spamreader:
            stations[3] = [row[4], row[5]]
    with open(curpath+'/japan-data/trips.csv') as file:
        spamreader = csv.reader(file, dlimiter=',', quotechar='|')
        for row in spamreader:
            data.append(row)
    for row in data[1:]:
        if row[1] == year and row[2] == month and row[3] == day:   
            starttime = row[4]*60*60+row[5]*60
            endtime = row[19]*60*60+row[20]*60
            duration = row[33]
            duration = endtime - starttime
            stationdid = row[
'''

def generate_taxi_trips(max_dist, ratio, frequency, starthrs, endhrs):
    '''
    '''
    data = []
    trips = []
    curpath = os.path.dirname(os.path.abspath(__file__))
    with open(curpath+'/Data/taxi-data-97.csv','rU') as file:
        spamreader = csv.reader(file, delimiter=',', quotechar='|')
        for row in spamreader:
            data.append(row)
        
    for row in data[1:]:
        pretime = row[1]
        time = int(pretime[-8:-6])*60*60+int(pretime[-5:-3])*60+int(pretime[-2:])
        if time <= starthrs * 60 * 60:
            continue
        if time >= endhrs * 60 * 60:
            break
        rand_freq = random.randint(1, 100)
        if rand_freq > frequency:
            continue
        start = [row[3], row[4]]
        end = [row[7], row[8]]
        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer_half_mile(start)))
        rng = random.randint(1, 100)
        kind = "Passenger"
        req = None
        if rng > ratio:
            kind = "Parcel"
        dest = find_snap_coordinates(get_snap_output(gaussian_randomizer_half_mile(end)))
        if dist(start_point, dest) < max_dist:
            req = Request(time, start_point, dest, "taxi", kind)
        else:
            print("long trip")

        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            trips.append(req)
    return trips


hubstations = {}  # global variable for Hubway stations dictionary
#[0]tripduration
#[1]starttime
#[2]stoptime
#[3]start station id
#[4]start station name
#[5]start station latitude
#[6]start station longitude
#[7]end station id
#[8]end station name
#[9]end station latitude
#[10]end station longitude
#[11]bikeid
#[12]usertype
#[13]birth year
#[14]gender

def generate_hubway_trips(max_trips, max_dist, ratio, frequency, starthrs, endhrs):
    '''
    Use hubway data to generate trips
    '''
    data = []
    trips = []
    curpath = os.path.dirname(os.path.abspath(__file__))

    with open(curpath+'/201707-hubway-tripdata.csv', 'rb') as file:
        spamreader = csv.reader(file, delimiter=',', quotechar='|')
        for row in spamreader:
            data.append(row)
    for row in data[1:]:
        # print row
        if len(hubstations.keys()) != 194:
            if row[3] not in hubstations.keys():
                loc2 = row[5].strip('\"')
                loc1 = row[6].strip('\"')
                hubstations[row[3]] = [loc1, loc2]
            if row[7] not in hubstations.keys():
                loc2 = row[9].strip('\"')
                loc1 = row[10].strip('\"')
                hubstations[row[7]] = [loc1, loc2]
        pretime = row[1]
        time = int(pretime[-8:-6])*60*60+int(pretime[-5:-3])*60+int(pretime[-2:])
        # TIME IN SECONDS
        if time <= starthrs * 60 * 60:
            continue
        if time >= endhrs * 60 * 60:
            break
        rand_freq = random.randint(1, 100)
        if rand_freq > frequency:
            continue
        start = row[3]
        end = row[7]
        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer_half_mile(hubstations[start])))
        rng = random.randint(1, 100)
        kind = "Passenger"
        req = None
        if rng > ratio:
            kind = "Parcel"
        if start == end:
            fake_dest = find_snap_coordinates(get_snap_output(gaussian_randomizer_two_mile(hubstations[start])))
            # print fake_dest
            req = Request(time, start_point, fake_dest, "bike", kind)

        else:
            # real trip
            dest = find_snap_coordinates(get_snap_output(gaussian_randomizer_half_mile(hubstations[end])))
            if dist(hubstations[start], dest) < max_dist:
                # print "REAL: "+str(dest)
                req = Request(time, start_point, dest, "bike", kind)

        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            trips.append(req)
        if len(trips) >= max_trips:
            break
    return trips, hubstations


def find_closest_station(loc):
    '''
    Find station closest to loc
    '''
    min_dist = float('inf')
    min_stat = None
    for station in hubstations.keys():
        pos = hubstations[station]
        dis = dist(loc, pos)
        if des < min_dist:
            min_dist = dis
            min_stat = station
    return hubstations[station]


def max_stat_dist():
    '''
    Find max distance between any two hubstations
    '''
    max_dist = 0
    for station in hubstations:
        loc = hubstations[station]
        for station_ in hubstations:
            pos = hubstations[station_]
            dis = dist(loc, pos)
            if dis > max_dist:
                max_dist = dis
    return max_dist
