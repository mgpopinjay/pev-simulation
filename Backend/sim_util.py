''' Fernando Sanchez, August 2017 '''

import math
import csv
import random
import json
import requests
import numpy as np
import os
import heapq
import statistics
import logging
import socket
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

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
- assigntime: amount of waittime caused by not having enough vehicles
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
LOCAL_IP_ADDRESS = '127.0.0.1'
REMOTE_IP_ADDRESS = '18.27.78.188'
IP_PORT = '9002'

# Extract the IP address of `LOCAL` is on
#if LOCAL:
#    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#    s.connect(("8.8.8.8", 80))
#    LOCAL_IP_ADDRESS = s.getsockname()[0]
#    s.close()
#    IP_PORT = 9002

API_BASE = f'http://{LOCAL_IP_ADDRESS if LOCAL else REMOTE_IP_ADDRESS}:{IP_PORT}/'

hubstations = {}
CHARGING_STATIONS = []
MILES_TO_METERS = 1609.334


def get_osrm_output(start, end):
    '''
    Get OSRM route from start point to end point
    '''
    samp1 = 'route/v1/bicycle/'
    # samp1 = 'route/v1/driving/'
    samp2 = '?alternatives=false&steps=true&geometries=polyline&overview=simplified'
    # samp2 = ''
    samp1 = samp1 + str(start[0]) + ',' + str(start[1]) + ';'
    samp2 = str(end[0]) + ',' + str(end[1]) + samp2
    sample = API_BASE + samp1+samp2
    x = requests.get(sample)
    return x.text


def get_snap_output(point):
    '''
    Get OSRM position nearest to point
    '''
    samp1 = 'nearest/v1/bicycle/'
    # samp1 = 'nearest/v1/driving/'
    samp2 = '?number=1'
    samp1 = samp1 + str(point[0]) + ',' + str(point[1])
    sample = API_BASE + samp1 + samp2
    x = requests.get(sample)
    return x.text


def find_snap_coordinates(s):
    '''
    Find the closest snapped coordinate from an OSRM position
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
    Find the location of the leg of the trip we are on based on seconds elapsed
    ERROR POINT Pev traveling at 500+ kph, Need to analyze output to see if working as intended
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
        self.pickuptime = 0
        self.assigntime = 0
        self.osrm = get_osrm_output(self.pickup, self.dropoff)
        self.traveltime = round(find_total_duration(self.osrm))
        self.traveldist = find_total_distance(self.osrm)
        self.kind = kind

    def __eq__(self, other):
        return self.original_time == other.original_time

    def __ne__(self, other):
        return self.original_time != other.original_time

    def __lt__(self, other):
        return self.original_time < other.original_time

    def __le__(self, other):
        return self.original_time <= other.original_time

    def __gt__(self, other):
        return self.original_time > other.original_time

    def __ge__(self, other):
        return self.original_time >= other.original_time

    def __repr__(self):
        return f'[type: {type(self)}, time: {self.time}, pickup: {self.pickup}, dropoff: {self.dropoff}]'

    def __str__(self):
        return f'Print Method: type: {type(self)}, time: {self.time}, pickup: {self.pickup}, dropoff: {self.dropoff}'


class Navigation(Request):

    def __init__(self, time, start, end):
        Request.__init__(self, time, start, end)


class NavToCharge(Request):

    def __init__(self, time, start, end):
        Request.__init__(self, time, start, end)


class Rebalance(Request):

    def __init__(self, time, start, end, cut_short=False):
        Request.__init__(self, time, start, end)
        self.cut_short = cut_short  # whether this rebalancing trip was cut short to pickup a passenger
        self.end_time = self.time + self.traveltime

    def get_duration(self):
        self.traveltime = self.end_time - self.time


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
        self.traveltime = self.end_time - self.time


class Wait(Idle):

    def __init__(self, start_time, loc):
        Idle.__init__(self, start_time, loc)


class Recharge(Idle):

    def __init__(self, start_time, loc):
        Idle.__init__(self, start_time, loc)

class Maintenance(Idle):

    def __init__(self, start_time, loc):
        Idle.__init__(self, start_time, loc)

class Confirmation(Idle):

    def __init__(self, start_time, loc):
        Idle.__init__(self, start_time, loc)


class PEV(object):

    def __init__(self, iden, pos, time=0):
        '''
        '''
        self.spawn = pos
        self.pos = pos
        self.id = iden
        self.dispatcher = Dispatcher(self.id, self.pos, self)
        self.state = "IDLE"
        self.request = Idle(time, self.pos)
        self.confirmation = None # for secondary confirmation requests
        self.time = None
        self.prevtime = None
        self.movingtime = 0
        self.movingspace = 0
        self.utiltime = 0
        self.idletime = 0
        self.nav = None
        PEV_RANGE_MILES = 25
        self.power = PEV_RANGE_MILES * MILES_TO_METERS
        self.flag = False # true if pev has already completed customer trip

    def __eq__(self, other):
        return self.time == other.time

    def __ne__(self, other):
        return self.time != other.time

    def __lt__(self, other):
        try:  # For debug purposes when idle cars end up in the wrong lists
            return self.time < other.time
        except TypeError:
            logging.critical("PEV time comparison error")
            logging.critical(f"{self.state}, {self.id}, {self.time}, {self.request}, {self.nav}, {other.state}, {other.id}, {other.time}, {other.request}, {other.nav}")

    def __le__(self, other):
        return self.time <= other.time

    def __gt__(self, other):
        return self.time > other.time

    def __ge__(self, other):
        return self.time >= other.time

    def update(self, simTime, finishedTrips, navToCharge=False, finishedRequests=None, req=None, dispatchers=None, cars=None):
        prevState = self.dispatcher.state
        resp  = self.dispatcher.update(simTime, finishedTrips, navToCharge, finishedRequests, req, dispatchers)
        logging.info(f"Dispatcher {str(self.dispatcher.id).zfill(4)}: {prevState} -> {resp}")
        if self.state == "IDLE":
            if type(req) == navToCharge: # NOT USED
                idle = self.request
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                # find and navigate to closest charging station
                ycor, xcor = find_closest_charging_station(self.pos)
                nav = NavToCharge(simTime, self.pos, [str(ycor), str(xcor)])
                self.nav = nav
                self.prevtime = simTime
                self.time = simTime + self.nav.traveltime
                self.state = "NAVTOCHARGE"  # now navigating to charging place
                return "NAVTOCHARGE"
            elif type(req) == Request:
                if self.dispatcher.state is "MOUNT":
                    self.flag = False # reset flag upon new trip
                    # end idle and add to history
                    idle = self.request
                    idle.end_time = req.time
                    idle.get_duration()
                    self.idletime += idle.traveltime
                    assignFinishedTrip(finishedTrips, self.id, idle)

                    # triangular distribution for loading
                    self.request = req 
                    waitLoad = int(np.random.triangular(1,3,4))
                    self.prevtime = simTime
                    self.time = simTime + waitLoad
                    #self.pos = self.nav.dropoff
                    self.state = "WAITLOAD"
                    return "WAITLOAD"
                else:
                    return "IDLE"

            elif type(req) == Rebalance: # NOT USED
                # end idle and add to history
                idle = self.request
                idle.end_time = req.time
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                self.nav = req
                self.prevtime = req.time
                self.time = req.time + req.traveltime
                self.state = "REBALANCE"
                return "REBALANCE"
            else:
                return f"Idling at {self.pos}."

        elif self.state == "NAV":
            if simTime >= self.time:
                # end nav and wait for loading
                self.movingtime += self.nav.traveltime
                self.movingspace += self.nav.traveldist
                self.request.pickuptime = self.nav.traveltime  # record how long pickup took
                #self.power -= self.request.traveldist
                assignFinishedTrip(finishedTrips, self.id, self.nav)

                # Create idle state for PEV confirming destination has been reached
                ''' become idle '''
                self.confirmation = Confirmation(self.time, self.pos)
                self.prevtime = self.time
                self.time = None
                self.state = "ARRIVED"
                return "ARRIVED"
            else:
                return f"Navigating to {self.nav.dropoff}"

        elif self.state == "WAITLOAD":
            if simTime >= self.time:
                # end wait and move to destination
                wait = Wait(self.prevtime, self.pos)
                wait.kind = "WaitLoad"
                wait.end_time = self.time
                wait.get_duration()
                # self.idletime += wait.traveltime
                assignFinishedTrip(finishedTrips, self.id, wait)
                if self.dispatcher.state == "MOUNT":
                    ''' become idle '''
                    self.confirmation = Confirmation(self.time, self.pos)
                    self.prevtime = self.time
                    self.time = None
                    self.state = "LOADED"
                    return "LOADED"
                else:
                    # transport to destination
                    self.request.time = self.time  # update request start time to the current time
                    self.prevtime = self.time
                    self.time += self.request.traveltime
                    self.state = "TRANSPORT"
                    return "TRANSPORT"
            else:
                return f"Waiting for pickup at {self.pos}."
        elif self.state == "LOADED":
            if self.dispatcher.state == "TRANSPORT":
                # end load and move to destination
                idle = self.confirmation
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                # create navigation and move to pickup
                if self.flag: # should go back to station if it has already served the customer
                    nav = Navigation(simTime, self.pos, self.spawn)
                    self.nav = nav
                    self.prevtime = simTime
                    self.time = simTime + self.nav.traveltime
                    self.state = "NAV"
                    return "NAV"
                else:
                    nav = Navigation(self.request.time, self.pos, self.request.pickup)
                    self.nav = nav
                    self.prevtime = self.request.time
                    self.time = self.request.time + self.nav.traveltime
                    self.state = "NAV"
                    return "NAV"
        elif self.state == "ARRIVED":
            if self.dispatcher.state == "UNMOUNT":
                # end confirmation and begin pickup
                idle = self.confirmation
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                if self.flag: # arrived at station after dropoff
                    self.confirmation = Confirmation(simTime, self.pos)
                    self.prevtime = self.time
                    self.time = None
                    self.state = "STANDBYMAINTENANCE"
                    return "STANDBYMAINTENANCE"
                else:
                    # triangular distribution for loading
                    waitLoad = int(np.random.triangular(1,3,4))
                    self.prevtime = simTime
                    self.time = simTime + waitLoad
                    self.pos = self.nav.dropoff
                    self.state = "WAITLOAD"
                    return "WAITLOAD"
        elif self.state == "DROPOFF":
            if self.dispatcher.state == "MOUNT":
                # end confirmation and begin heading back to station
                idle = self.confirmation
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                # triangular distribution for loading
                waitLoad = int(np.random.triangular(1,3,4))
                self.prevtime = simTime
                self.time = simTime + waitLoad
                self.pos = self.nav.dropoff
                self.state = "WAITLOAD"
                return "WAITLOAD"
        elif self.state == "TRANSPORT":
            if simTime >= self.time:
                ''' end transport and wait for unloading '''
                self.movingtime += self.request.traveltime
                self.movingspace += self.nav.traveldist
                self.utiltime += self.request.traveltime
                #self.power -= self.request.traveldist
                assignFinishedTrip(finishedTrips, self.id, self.request)
                finishedRequests.append(self.request)
                self.flag = True # confirm trip has been completed
                # triangular distribution for unload time
                waitLoad = int(np.random.triangular(1,3,6))
                self.prevtime = self.time
                self.time += waitLoad
                self.pos = self.request.dropoff
                self.state = "WAITUNLOAD"
                return "WAITUNLOAD"
            else:
                return f"Transporting to {self.request.dropoff}."
        elif self.state == "STANDBYMAINTENANCE":
            if self.dispatcher.state == "MAINTENANCE":
                # end confirmation and begin heading back to station
                idle = self.confirmation
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                # triangular distribution for maintenance
                maintenance = int(np.random.triangular(1,6,9))
                self.prevtime = simTime
                self.time = simTime + maintenance
                self.pos = self.nav.dropoff
                self.state = "MAINTENANCE"
                return "MAINTENANCE"
        elif self.state == "MAINTENANCE":
            if simTime >= self.time:
                ''' end wait and become idle '''
                maintenance = Maintenance(self.prevtime, self.pos)
                maintenance.kind = "MAINTENANCE"
                maintenance.end_time = self.time
                maintenance.get_duration()
                assignFinishedTrip(finishedTrips, self.id, maintenance)
                if self.dispatcher.state == "MAINTENANCE":
                    ''' become idle '''
                    self.confirmation = Confirmation(self.time, self.pos)
                    self.prevtime = self.time
                    self.time = None
                    self.state = "MAINTAINED"
                    return "MAINTAINED"
        elif self.state == "MAINTAINED":
            if self.dispatcher.state == "IDLE":
                # end confirmation and go idle
                idle = self.confirmation
                idle.end_time = simTime
                idle.get_duration()
                self.idletime += idle.traveltime
                assignFinishedTrip(finishedTrips, self.id, idle)
                self.request = Idle(simTime, self.pos)
                self.prevtime = self.time
                self.time = None
                self.state = "IDLE"
                return "IDLE"
        elif self.state == "WAITUNLOAD":
            if simTime >= self.time:
                ''' end wait and become idle '''
                wait = Wait(self.prevtime, self.pos)
                wait.kind = "WaitUnload"
                wait.end_time = self.time
                wait.get_duration()
                # self.idletime += wait.traveltime
                assignFinishedTrip(finishedTrips, self.id, wait)
                if self.dispatcher.state == "WAITTRIP":
                    ''' become idle '''
                    self.confirmation = Confirmation(self.time, self.pos)
                    self.prevtime = self.time
                    self.time = None
                    self.state = "DROPOFF"
                    return "DROPOFF"
            else:
                return f"Waiting for dropoff at {self.pos}."

        elif self.state == "NAVTOCHARGE": # NOT USED
            if simTime >= self.time:
                ''' end navigating to recharge and become recharging '''
                self.movingtime += self.nav.traveltime
                self.movingspace += self.nav.traveldist
                self.utiltime += self.nav.traveltime
                self.power -= self.nav.traveldist
                assignFinishedTrip(finishedTrips, self.id, self.nav)
                self.prevtime = self.time
                # Adds time proportional to 25 - distance left assuming charging at 25 mi/hr)
                time_to_charge = round((25 - (self.power / 1609.344)) * 60 * 60 / 25)
                self.time += time_to_charge
                print("recharging", self.id, self.time, time_to_charge)
                self.pos = self.nav.dropoff
                self.state = "RECHARGE"
                return "RECHARGE"
            else:
                return f"NavToCharge at {self.pos}."

        elif self.state == "RECHARGE": # Not Used
            if simTime >= self.time:
                ''' end recharging(waiting) and become idle '''
                recharge = Recharge(self.prevtime, self.pos)
                recharge.end_time = self.time
                recharge.get_duration()
                assignFinishedTrip(finishedTrips, self.id, recharge)

                ''' become idle '''
                self.request = Idle(self.time, self.pos)
                self.prevtime = self.time
                self.time = None
                self.state = "IDLE"
                return "IDLE"
            else:
                return f"Recharge at {self.pos}."

        elif self.state == "REBALANCE": # Not Used
            if type(req) == Request:
                self.updateLocation(req.time)
                reb = self.nav
                reb.cut_short = True
                reb.osrm = get_osrm_output(reb.pickup, self.pos)
                reb.end_time = req.time
                reb.get_duration()
                self.movingtime += reb.traveltime
                self.movingspace += reb.traveldist
                assignFinishedTrip(finishedTrips, self.id, reb)
                # create navigation
                self.request = req
                nav = Navigation(req.time, self.pos, self.request.pickup)
                self.nav = nav
                self.prevtime = req.time
                self.time = req.time + self.nav.traveltime
                self.state = "NAV"
                return "NAV"
            elif simTime >= self.time:
                self.movingtime += self.nav.traveltime
                self.movingspace += self.nav.traveldist
                assignFinishedTrip(finishedTrips, self.id, self.nav)
                self.request = Idle(self.time, self.nav.dropoff)  # Potential source of error for location
                self.prevtime = self.time
                self.time = None
                self.state = "IDLE"
                return "IDLE"
            else:
                self.updateLocation(simTime)
                return f"Currently at {self.pos} on the way to {self.nav.dropoff}."

    def updateLocation(self, simTime):
        ''' Update car location while rebalancing '''
        elapsedTime = simTime - self.nav.time
        newPos = find_leg_loc(self.nav.osrm, elapsedTime)
        self.pos = newPos
        return self.pos

class Dispatcher(object):
    def __init__(self, iden, pos, pev, time=0):
        self.spawn = pos
        self.pos = pos
        self.pev = pev
        self.id = iden
        self.state = "IDLE"
        self.request = Idle(time, self.pos)
        self.time = None
        self.prevtime = None
        self.movingtime = 0
        self.movingspace = 0
        self.utiltime = 0
        self.idletime = 0
        self.nav = None

    def __eq__(self, other):
        return self.time == other.time

    def __ne__(self, other):
        return self.time != other.time

    def __lt__(self, other):
        try:  # For debug purposes when idle cars end up in the wrong lists
            return self.time < other.time
        except TypeError:
            logging.critical("DISPATCHER time comparison error")
            logging.critical(f"{self.state}, {self.id}, {self.time}, {self.request}, {self.nav}, {other.state}, {other.id}, {other.time}, {other.request}, {other.nav}")

    def __le__(self, other):
        return self.time <= other.time

    def __gt__(self, other):
        return self.time > other.time

    def __ge__(self, other):
        return self.time >= other.time

    def update(self, simTime, finishedTrips, navToCharge=False, finishedRequests=None, req=None, dispatchers=None):
        self.prevtime = self.time
        self.time = simTime
        if self.state == "IDLE":
            if type(req) == Request:
                self.state = "MOUNT"
                for i in range(len(dispatchers['freeDispatchers'])):
                    if dispatchers['freeDispatchers'][i].id is self.id:
                        del dispatchers['freeDispatchers'][i]
                        break
                heapq.heappush(dispatchers['waitConfirmDispatchers'], self)
                return "MOUNT"
        elif self.state == "MOUNT":
            if self.pev.state == "LOADED":
                self.state = "TRANSPORT"
                for i in range(len(dispatchers['waitConfirmDispatchers'])):
                    if dispatchers['waitConfirmDispatchers'][i].id is self.id:
                        del dispatchers['waitConfirmDispatchers'][i]
                        break
                heapq.heappush(dispatchers['busyDispatchers'], self)
                return "TRANSPORT"
            return self.state
        elif self.state == "TRANSPORT":
            if self.pev.state == "ARRIVED":
                self.state = "UNMOUNT"
                for i in range(len(dispatchers['busyDispatchers'])):
                    if dispatchers['busyDispatchers'][i].id is self.id:
                        del dispatchers['busyDispatchers'][i]
                        break
                heapq.heappush(dispatchers['waitConfirmDispatchers'], self)
                return "UNMOUNT"
            elif self.pev.state == "NAV":
                return self.state
        elif self.state == "UNMOUNT":
            if self.pev.state == "TRANSPORT":
                self.state = "WAITTRIP" # wait for trip to finish
                return "WAITTRIP"
            elif self.pev.state == "WAITLOAD":
                return self.state
            elif self.pev.state == "STANDBYMAINTENANCE":
                 self.state = "MAINTENANCE"
                 for i in range(len(dispatchers['waitConfirmDispatchers'])):
                    if dispatchers['waitConfirmDispatchers'][i].id is self.id:
                        del dispatchers['waitConfirmDispatchers'][i]
                        break
                 heapq.heappush(dispatchers['maintenanceDispatchers'], self)
                 return "MAINTENANCE"
        elif self.state == "WAITTRIP":
            if self.pev.state == "DROPOFF":
                self.state = "MOUNT"
                return "MOUNT"
            elif self.pev.state == "WAITUNLOAD":
                return self.state
        elif self.state == "MAINTENANCE":
            if self.pev.state == "MAINTAINED":
                self.state = "IDLE"
                for i in range(len(dispatchers['maintenanceDispatchers'])):
                    if dispatchers['maintenanceDispatchers'][i].id is self.id:
                        del dispatchers['maintenanceDispatchers'][i]
                        break
                dispatchers['freeDispatchers'].append(self)
                return "IDLE"
            else:
                return self.state
                
class RebalanceData():
    def __init__(self, centers, weights):
        self.centers = centers
        self.weights = weights


# class RebalanceData():
#     # object for maintaining cluster data

#     def __init__(self, spreadsheet, k):
#         '''
#         Process data for clustering for rebalancing
#         '''
#         data1 = []
#         for i in range(spreadsheet, spreadsheet+1):  # start with 1 spreadsheet of data (the last hour) and update with completed trips
#             samp = 'Data/Hour_'+str(i)+'_100.csv'
#             with open(samp, 'rb') as file:
#                 spamreader = csv.reader(file, delimiter=',', quotechar='|')
#                 for row in spamreader:
#                     data1.append(row)
#         self.points = []
#         for row in data1:
#             temp = [float(row[3]), float(row[4])]
#             self.points.append(temp)
#         self.means = []
#         self.k = k

#     # Lloyd's alg for k-means-clustering
#     # credit to https://datasciencelab.wordpress.com/2013/12/12/clustering-with-k-means-in-python/
#     def cluster(self):
#         # associate each point with a cluster
#         clusters = {}
#         for x in self.points:
#             bestmean = min([(i[0], np.linalg.norm([i-j for i, j in zip(list(x), list(self.means[i[0]]))])) for i in enumerate(self.means)], key=lambda t: t[1])[0]
#             try:
#                 clusters[bestmean].append(x)
#             except KeyError:
#                 clusters[bestmean] = [x]
#         return clusters

#     def reevaluate(self, clusters):
#         # find new clusters
#         new_means = []
#         keys = sorted(clusters.keys())
#         for k in keys:
#             new_means.append(np.mean(clusters[k], axis=0))
#         return new_means

#     def has_converged(self, old_means):
#         # check for convergence
#         return (set([tuple(a) for a in self.means]) == set([tuple(a) for a in old_means]))

#     def find_centers(self):
#         # initialize
#         oldmeans = random.sample(self.points, self.k)
#         self.means = random.sample(self.points, self.k)
#         # run until convergence
#         while not self.has_converged(oldmeans):
#             oldmeans = self.means
#             clusters = self.cluster()
#             self.means = self.reevaluate(clusters)
#         return (self.means, clusters)


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


def generate_random_requests(location, ratio, frequency, starthrs, endhrs, dist, fuzzing_enabled):
    '''
    Generate random requests centered around 'location' with a ratio of 'dist'
    '''
    requests = []
    # percent random request every minute
    for time in range(starthrs*60, endhrs*60):
        if random.randint(1, 100) > frequency:
            continue
        kind = "Passenger"
        if random.randint(1, 100) <= ratio:
            kind = "Parcel" #CHANGE BACK TO PARCEL
        start = gaussian_randomizer(location, dist, fuzzing_enabled)
        end = gaussian_randomizer(start, dist, fuzzing_enabled)
        start_point = find_snap_coordinates(get_snap_output(start))
        end_point = find_snap_coordinates(get_snap_output(end))
        req = Request(time*60, start_point, end_point, "random",  kind)
        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            requests.append(req)
    return requests


def populate_requests(num_spreadsheets, max_dist, ratio):
    # CURRENTLY UNUSED
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


def gaussian_randomizer(location, distance, fuzzing_enabled):
    '''
    Pick a random point within X km radius of location using gaussian distribution
    Best accuracy between 0-15 km
    '''
    if fuzzing_enabled is False:
        return location

    d = distance
    c = 3.17681940e-06*d*d + 1.95948301e-06*d
    cov = [[c, 0], [0, c]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo


def gaussian_randomizer_half_mile(location, fuzzing_enabled):
    '''
    Pick a random point within ~.5 mile radius of location using gaussian distribution
    '''
    if fuzzing_enabled is False:
        return location

    cov = [[.000005, 0], [0, .000005]]
    loc1 = location[0].strip('\"')
    loc2 = location[1].strip('\"')
    loc = [float(loc1), float(loc2)]
    point = np.random.multivariate_normal(loc, cov)
    pointo = [str(point[0]), str(point[1])]
    return pointo


def gaussian_randomizer_two_mile(location, fuzzing_enabled):
    '''
    Pick a random point within ~.5 mile radius of location using gaussian distribution
    '''
    if fuzzing_enabled is False:
        return location

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


def generate_PEV_spawns(mapName, sample_percent=1):
    '''
    Input: name of city, station sample percentage
    Output 1: list of coordinates of spawn points in (lon,lat)
    Output 2: list of weights between 0-1, chance to spawn
    '''
    LAT = 2
    LON = 3
    EXPOSED = 5
    SPACE = 6
    coords = []
    dockSpace = []
    data = []
    curpath = os.path.dirname(os.path.abspath(__file__))
    if mapName == "Taipei":
        return [121.502746, 25.031213], [1]
    with open(curpath+'/Data/Hubway_Stations_as_of_July_2017.csv', 'rU') as file:
        spamreader = csv.reader(file, delimiter=',', quotechar='|')
        for row in spamreader:
            data.append(row)
    print(data)
    for row in data[1:]:
        if row[EXPOSED] == '1':
            coords.append((row[LON], row[LAT]))
            dockSpace.append(int(row[SPACE]))

    # Zips coords, dockspaces together, shuffles the order, and returns a
    # percentage of the total sample and their corresponding weights.
    z = list(zip(coords, dockSpace))
    random.shuffle(z)
    z = z[:int(sample_percent*len(z))]
    coords[:], dockSpace[:] = zip(*z)
    spaceTotal = sum(dockSpace)
    weights = [s / spaceTotal for s in dockSpace]

    return coords, weights


def generate_taxi_trips(max_dist, ratio, frequency, starthrs, endhrs, fuzzing_enabled):
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
            continue
        rand_freq = random.randint(1, 100)
        if rand_freq > frequency:
            continue
        start = [row[3], row[4]]
        end = [row[7], row[8]]
        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer(start, 0.8, fuzzing_enabled)))
        rng = random.randint(1, 100)
        kind = "Passenger"
        req = None
        if rng <= ratio:
            kind = "Parcel"
        dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(end, 0.8, fuzzing_enabled)))
        if dist(start_point, dest) < max_dist:
            req = Request(time, start_point, dest, "taxi", kind)
        else:
            logging.info("Trip greater than max dist")

        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            trips.append(req)
    return trips


def generate_hubway_trips(max_dist, ratio, frequency, starthrs, endhrs, fuzzing_enabled):
    '''
    Use hubway data to generate trips
    '''
    data = []
    trips = []
    curpath = os.path.dirname(os.path.abspath(__file__))

    with open(curpath+'/hubway-day.csv', 'rU') as file:
        spamreader = csv.reader(file, delimiter=',', quotechar='|')
        for row in spamreader:
            data.append(row)
    for row in data[1:]:
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
            continue
        rand_freq = random.randint(1, 100)
        if rand_freq > frequency:
            continue
        start = row[3]
        end = row[7]
        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer(hubstations[start], 0.8, fuzzing_enabled)))
        rng = random.randint(1, 100)
        kind = "Passenger"
        req = None
        if rng <= ratio:
            kind = "Parcel"
        if start == end:
            fake_dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(hubstations[start], 3.2, fuzzing_enabled)))
            # print fake_dest
            req = Request(time, start_point, fake_dest, "bike", kind)

        else:
            # real trip
            dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(hubstations[end], 0.8, fuzzing_enabled)))
            if dist(hubstations[start], dest) < max_dist:
                req = Request(time, start_point, dest, "bike", kind)

        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            trips.append(req)
    return trips, hubstations


def generate_youbike_trips(max_dist, ratio, frequency, starthrs, endhrs, fuzzing_enabled):
    '''
    Use youbike data to generate trips
    '''
    data = []
    trips = []
    curpath = os.path.dirname(os.path.abspath(__file__))

    with open(curpath+'/youbike-day.csv', 'rU') as file:
        spamreader = csv.reader(file, delimiter=',')
        for row in spamreader:
            data.append(row)
    current_count = 0
    logging.info("Generating YouBike trips:")
    for row in data[1:]:
        pretime = row[0]
        time = int(pretime[-8:-6])*60*60+int(pretime[-5:-3])*60+int(pretime[-2:])
        # TIME IN SECONDS
        if time <= starthrs * 60 * 60:
            continue
        if time >= endhrs * 60 * 60:
            continue
        rand_freq = random.randint(1, 100)
        if rand_freq > frequency:
            continue
        startpos = [row[2].strip(' '), row[1].strip(' ')]
        endpos = [row[4].strip(' '), row[3].strip(' ')]
        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer(startpos, 0.8, fuzzing_enabled)))
        rng = random.randint(1, 100)
        kind = "Passenger"
        req = None
        if current_count % 2500 == 0:
            logging.info(current_count)
        current_count += 1
        if rng <= ratio:
            kind = "Parcel"
        if startpos == endpos:
            fake_dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(startpos, 3.2, fuzzing_enabled)))
            # print fake_dest
            req = Request(time, start_point, fake_dest, "bike", kind)

        else:
            # real trip
            dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(endpos, 0.8, fuzzing_enabled)))
            if dist(startpos, dest) < max_dist:
                req = Request(time, start_point, dest, "bike", kind)

        if req is not None and json.loads(req.osrm)["code"] == "Ok":
            trips.append(req)
    return trips


def generate_train_requests(max_dist, frequency, starthrs, endhrs, fuzzing_enabled):
    rider_estimate = 0.00001370577366 # 2000 riders per day will request a PEV to take them to or away from a stop at 100%
    '''
    Use train data to generate trips
    '''
    trips = []
    sData = [] # MBTA_GTFS/stops.txt
    gData = [] # gated_station_entries_2018.csv
    curpath = os.path.dirname(os.path.abspath(__file__))
    with open(curpath+'/MBTA_GTFS/stops.txt', 'rU') as file:
        spamreader = csv.reader(file, delimiter=',')
        for row in spamreader:
            sData.append(row)
    with open(curpath+'/gated_station_entries_2018.csv', 'rU') as file:
        spamreader = csv.reader(file, delimiter=',')
        for row in spamreader:
            gData.append(row)
    current_count = 0
    kind = "Passenger"
    for gRow in gData[1:]:
        pretime = gRow[3]
        time = int(pretime[-4:-2])*60*60+int(pretime[-2:])*60
        if time <= starthrs * 60 * 60:
            continue
        if time >= endhrs * 60 * 60:
            continue
        rand_freq = random.uniform(0, 200)
        if rand_freq >= frequency * rider_estimate * 100:
            continue
        for sRow in sData[1:]:
            if(gRow[1] == sRow[0]):
                runtime = time - random.randint(-1, 14)
                endpos = [sRow[7].strip(' '), sRow[6].strip(' ')]
                start_point = endpos
                dest = endpos
                coin_flip = random.randint(0,1) # half of the entries will be made departures
                if(coin_flip != True):
                    # Arrival
                    while start_point == dest:
                        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer(endpos, 3.2, fuzzing_enabled)))
                        dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(endpos, 0.8, fuzzing_enabled)))
                    runtime -= find_total_duration(get_osrm_output(start_point, dest)) # adjusts request time to that person arrives to train station during correct gated_station_entry time period
                else:
                    # Departure
                    while start_point == dest:
                        start_point = find_snap_coordinates(get_snap_output(gaussian_randomizer(endpos, 0.8, fuzzing_enabled)))
                        dest = find_snap_coordinates(get_snap_output(gaussian_randomizer(endpos, 3.2, fuzzing_enabled)))
                if(dist(start_point, dest) <= max_dist):
                    req = Request(runtime, start_point, dest, "train", kind)
                else:
                    print("train long trip")
                if req is not None and json.loads(req.osrm)["code"] == "Ok":
                    trips.append(req)
    return trips;


def find_closest_station(loc):
    '''
    Find station closest to loc
    '''
    min_dist = float('inf')
    min_stat = None
    for station in hubstations.keys():
        pos = hubstations[station]
        dis = dist(loc, pos)
        if dis < min_dist:
            min_dist = dis
            min_stat = station
    return hubstations[min_stat]


def find_closest_charging_station(loc):
    '''
    Find charging station closest to loc
    '''

    temp_min = 10000.0
    ycor = 0
    xcor = 0
    for i in range(len(CHARGING_STATIONS)):
        distance = dist(CHARGING_STATIONS[i], loc)
        if distance < temp_min:
            temp_min = distance
            ycor = CHARGING_STATIONS[i][0]
            xcor = CHARGING_STATIONS[i][1]
    return ycor, xcor


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


def assignFinishedTrip(lst, iden, trip):
    if iden in lst.keys():
        lst[iden].append(trip)
    else:
        lst[iden] = [trip]
    return lst


def updateBusyCars(simTime, cars, dispatchers, logs, CHARGING_ON, CHARGE_LIMIT):
    '''
    Check if
    '''
    updatedCars = []  # debug purposes
    REBALANCING = False
    # no charging or rebalancing in this model
    '''
    if len(cars['freeCars']) > 0:
        deleteFromFree = []
        for i in range(len(cars['freeCars'])):
            car = cars['freeCars'][i]
            if CHARGING_ON and car.power <= CHARGE_LIMIT * 1609.344:
                # send car to charging station
                prevState = car.state
                resp = car.update(simTime, logs['finishedTrips'], True)
                logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
                heapq.heappush(cars['navToChargeCars'], car)  # now busy
                deleteFromFree.append(i)
            elif REBALANCING:
                start_point = car.pos
                endpos = gaussian_randomizer(start_point, 5, True)
                end_point = find_snap_coordinates(get_snap_output(endpos))
                req = Rebalance(simTime, start_point, end_point)
                car.update(simTime, logs['finishedTrips'], req=req)
                heapq.heappush(cars['rebalancingCars'], car)
                deleteFromFree.append(i)
        for i in deleteFromFree[::-1]:
            del cars['freeCars'][i]
    '''
    
    if len(cars['busyCars']) > 0:
        while simTime >= cars['busyCars'][0].time:
            # finish request
            car = heapq.heappop(cars['busyCars'])
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'], finishedRequests=logs['finishedRequests'])
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            heapq.heappush(cars['waitCars'], car)
            updatedCars.append(str(car.id))  # debug purposes

            if len(cars['busyCars']) == 0:
                break

    if len(cars['navCars']) > 0:
        while simTime >= cars['navCars'][0].time:
            # end navigation
            car = heapq.heappop(cars['navCars'])
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'], dispatchers=dispatchers)
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            if resp == "ARRIVED":
                cars['confirmationCars'].append(car)
            else:
                heapq.heappush(cars['waitCars'], car)
            updatedCars.append(str(car.id))

            if len(cars['navCars']) == 0:
                break

    while len(cars['confirmationCars']) > 0:
        # waiting on dispatch confirmattion not time
        deleteFromConf = []
        for i in range(len(cars['confirmationCars'])):
            car = cars['confirmationCars'][i]
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'], dispatchers=dispatchers)
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            if resp == "NAV":
                heapq.heappush(cars['navCars'], car)
                deleteFromConf.append(i)
            if resp == "WAITLOAD":
                heapq.heappush(cars['waitCars'], car)
                deleteFromConf.append(i)
            if resp == "MAINTENANCE":
                heapq.heappush(cars['maintenanceCars'], car)
                deleteFromConf.append(i)
            if resp == "IDLE": # cycle is complete
                cars['freeCars'].append(car)
                deleteFromConf.append(i)
            updatedCars.append(str(car.id))
        for i in deleteFromConf[::-1]:
            del cars['confirmationCars'][i]

    
    if len(cars['waitCars']) > 0:
        while simTime >= cars['waitCars'][0].time:
            # end waiting
            car = heapq.heappop(cars['waitCars'])
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'], dispatchers=dispatchers)
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            if resp == "LOADED" or resp == "DROPOFF":
                cars['confirmationCars'].append(car)
            if resp == "TRANSPORT":
                heapq.heappush(cars['busyCars'], car)
            if resp == "NAV":
                heapq.heappush(cars['navCars'], car)
            elif resp == "IDLE":
                cars['freeCars'].append(car)
            updatedCars.append(str(car.id))

            if len(cars['waitCars']) == 0:
                break
    '''
    if len(cars['navToChargeCars']) > 0:
        while simTime >= cars['navToChargeCars'][0].time:
            # end navigation to charging station
            car = heapq.heappop(cars['navToChargeCars'])
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'])
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            heapq.heappush(cars['maintenanceCars'], car)
            updatedCars.append(str(car.id))

            if len(cars['navToChargeCars']) == 0:
                break
    '''
    if len(cars['maintenanceCars']) > 0:
        while simTime >= cars['maintenanceCars'][0].time:
            # end maintenance
            car = heapq.heappop(cars['maintenanceCars'])
            #car.power = 25 * 1609.34
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'], dispatchers=dispatchers)
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            if resp == "MAINTAINED":
                cars['confirmationCars'].append(car)
            else:
                heapq.heappush(cars['maintenanceCars'], car)
            updatedCars.append(str(car.id))

            if len(cars['maintenanceCars']) == 0:
                break

    '''
    # no rebalancing in this model
    if len(cars['rebalancingCars']) > 0:
        while simTime >= cars['rebalancingCars'][0].time:
            car = heapq.heappop(cars['rebalancingCars'])
            prevState = car.state
            resp = car.update(simTime, logs['finishedTrips'])
            logging.info(f"Car {str(car.id).zfill(4)}: {prevState} -> {resp}")
            if resp == "IDLE":
                cars['freeCars'].append(car)
            updatedCars.append(str(car.id))

            if len(cars['rebalancingCars']) == 0:
                break
    '''

    if len(updatedCars) > 0:
        return f"Updated the following cars: {updatedCars}."
    else:
        return "No cars to update."

def analyzeResults(finishedRequests, freeCars, systemDelta, startHr, endHr):
    pickuptimes = []
    assigntimes = []
    waittimes = []
    traveltimes = []
    origins = {
        "taxi": 0,
        "bike": 0,
        "random": 0,
        "train": 0,
    }
    for req in finishedRequests:
        pickuptimes.append(req.pickuptime)
        assigntimes.append(req.assigntime)
        waittimes.append(req.pickuptime + req.assigntime)
        traveltimes.append(req.traveltime)
        if req.origin in origins:
            origins[req.origin] = origins[req.origin] + 1
        else:
            origins[req.origin] = 1

    waittimes.sort()

    movingtimes = []
    idletimes = []
    utiltimes = []
    navtimes = []
    for car in freeCars:
        movingtimes.append(car.movingtime)
        idletimes.append(car.idletime)
        utiltimes.append(car.utiltime)
        navtimes.append(car.movingtime-car.utiltime)

    ''' REBALANCING ANALYTICS
        rebaltimes = []
        rebaltraveltimes = []
        for re in rebalance_trips:
            time_as_hour = '0'+str(int(re.time)/60)+':'+str(int(re.time)%60)
            rebaltimes.append(time_as_hour)
            rebaltraveltimes.append(re.traveltime)
    '''

    # CALCULATE ANALYTICS
    # logging.warning("REBALANCE ON?: "+str(REBALANCE_ON)
    # logging.warning("RANDOM START?: "+str(RANDOM_START)
    logging.warning("Total Trips: {}".format(len(finishedRequests)))
    for origin in origins.keys():
        logging.warning(origin.upper()+" trips: {}".format(origins[origin]))
    # Avg time for PEV to travel to request
    avgReqPickup = round(statistics.mean(pickuptimes), 1)
    logging.warning(f"Average Request Pickup Time: {avgReqPickup}")
    # Avg time for PEV to be assigned to request
    avgReqAssign = round(statistics.mean(assigntimes), 1)
    logging.warning(f"Average Request Push Time: {avgReqAssign}")
    # Avg travel time of each request from origin to destination
    avgReqTravel = round(statistics.mean(traveltimes), 1)
    logging.warning(f"Average Request Travel Time: {avgReqTravel}")
    # Avg time moving with passenger
    avgCarTravel = round(statistics.mean(utiltimes), 1)
    logging.warning(f"Average Car Utilization Time: {avgCarTravel}")
    # Avg time moving without passenger
    avgCarNavigate = round(statistics.mean(navtimes), 1)
    logging.warning(f"Average Car Navigation Time: {avgCarNavigate}")
    # Avg time spent moving
    avgCarMove = round(statistics.mean(movingtimes), 1)
    logging.warning(f"Average Car Moving Time: {avgCarMove}")
    # Percent of daytime with passenger
    percentTravelOverDay = round(avgCarTravel/((endHr-startHr)*3600)*100, 1)
    logging.warning(f"Average Passenger/Parcel Utilization Percentage: {percentTravelOverDay}")
    # Percent of moving time with passenger
    percentTravelOverMove = round(avgCarTravel/avgCarMove*100, 1)
    logging.warning(f"Average Car Utilization Percentage: {percentTravelOverMove}")
    # Avg time spent idle
    avgCarIdle = round(statistics.mean(idletimes), 1)
    logging.warning(f"Average Car Idle Time: {avgCarIdle}")
    # Percent of total time spent idle
    percentIdleOverTotal = round(avgCarIdle/(avgCarIdle+avgCarMove)*100, 1)
    logging.warning(f"Average Car Idle Percentage: {percentIdleOverTotal}")
    # Percent of total time spent moving
    percentMoveOverTotal = round(avgCarMove/(avgCarMove+avgCarIdle)*100, 1)
    logging.warning(f"Average Car Movement Percentage: {percentMoveOverTotal}")

    # waitDist is the distribution of waittimes in 5 min intervals
    waitDist = [0 for i in range(math.ceil(waittimes[-1]/60/5))]
    # Place each time into bin
    for n in waittimes:
        currentBin = math.floor(n/60/5)
        waitDist[currentBin] += 1
    # Waittime analytics
    # Avg wait time
    avgReqWait = statistics.mean(waittimes)
    logging.warning(f"Average Wait Time: {avgReqWait}")
    # Request wait time 50th percentile
    waitTime50p = waittimes[len(waittimes)//2]
    logging.warning(f"50th Percentile Wait Time: {waitTime50p}")
    # Request wait time 75th percentile
    waitTime75p = waittimes[len(waittimes)*3//4]
    logging.warning(f"75th Percentile Wait Time: {waitTime75p}")
    # Request wait time distribution by 5 minute bins
    logging.warning(f"Distribution of Wait Times by 5 min: {waitDist}")

    ''' MORE REBALANCING ANALYTICS TODO: Fix this
    logging.warning("NUM REBALANCING TRIPS: "+str(len(rebalance_trips)))
    logging.warning("TIME OF REBALANCE TRIPS: \n"+str(rebaltimes))
    logging.warning("LENGTH OF REBALANCE TRIPS: \n"+str(rebaltraveltimes))
    r_avg = reduce(lambda x,y:x+y, rebaltraveltimes)/len(rebaltraveltimes)
    logging.warning("AVERAGE LENGTH OF REBALANCE TRIP: "+str(r_avg))
    '''

    simOutputs = {
        "TRIPS": origins,
        "TRIPS_HR": round(len(finishedRequests)/(endHr-startHr), 1),
        "TRIPS_DAY": len(finishedRequests)/(endHr-startHr)*24,
        "SIM RUNTIME": str(systemDelta),
        "AVERAGE REQUEST PI/updateCKUPTIME": str(avgReqPickup),
        "AVERAGE REQUEST ASSIGNTIME": str(avgReqAssign),
        "AVERAGE REQUEST TRAVELTIME": str(avgReqTravel),
        "AVERAGE CAR UTILIZATION": str(avgCarTravel),
        "AVERAGE CAR NAVIGATION": str(avgCarNavigate),
        "AVERAGE CAR MOVINGTIME": str(avgCarMove),
        "AVERAGE CAR IDLETIME": str(avgCarIdle),
        "AVERAGE PEOPLE/PARCEL UTILIZATION": str(percentTravelOverDay),
        "AVERAGE CAR UTILIZATION PERCENTAGE": str(percentTravelOverMove),
        "AVERAGE CAR MOVEMENT PERCENTAGE": str(percentMoveOverTotal),
        "AVERAGE CAR IDLE PERCENTAGE": str(percentIdleOverTotal),
        "WAITTIME AVERAGE": str(avgReqWait),
        "WAITTIME 50th PERCENTILE": str(waitTime50p),
        "WAITTIME 75th PERCENTILE": str(waitTime75p),
        "WAITTIME DISTRIBUTION": waitDist,
    }

    return simOutputs

def getCarData(totalCars, finishedTrips):
    carData = {}
    for car in totalCars:
        carData[car] = {"history": [], "spawn": totalCars[car].spawn}
    for car in finishedTrips.keys():
        trips = finishedTrips[car]
        formattedTrips = []
        for i in range(len(trips)):
            trip = trips[i]
            tripJson = {}
            tripJson["orig_time"] = trip.original_time
            tripJson["start_time"] = trip.time
            tripJson["end_time"] = trip.time+trip.traveltime
            tripJson["duration"] = trip.traveltime
            tripJson["id"] = i
            tripJson["pickuptime"] = 0
            tripJson["assigntime"] = 0
            if type(trip) == Recharge:
                tripJson["type"] = "Recharge"
                tripJson["start_point"] = trip.osrm
            elif type(trip) == Idle:
                tripJson["type"] = "Idle"
                tripJson["start_point"] = trip.osrm  # location listed under this name for visualizer
            elif type(trip) == Wait:
                tripJson["type"] = trip.kind
                tripJson["start_point"] = trip.osrm  # location listed under this name for visualizer
            elif type(trip) == Maintenance:
                tripJson["type"] = "Maintenance"
                tripJson["start_point"] = trip.osrm  # location listed under this name for visualizer
            elif type(trip) == Confirmation:
                tripJson["type"] = "Confirmation"
                tripJson["start_point"] = trip.osrm  # location listed under this name for visualizer
            else:
                tripJson["steps_polyline"] = parse_for_visualizer_steps(trip.osrm)
                tripJson["overview_polyline"] = parse_for_visualizer_whole(trip.osrm)
                tripJson["start_point"] = trip.pickup
                tripJson["end_point"] = trip.dropoff
                if type(trip) == NavToCharge:
                    tripJson["type"] = "NavToCharge"
                elif type(trip) == Rebalance:
                    tripJson["type"] = "Rebalance"
                    tripJson["cut_short"] = trip.cut_short
                elif type(trip) == Navigation:
                    tripJson["type"] = "Navigation"
                else:
                    tripJson["type"] = trip.kind
                    tripJson["assigntime"] = trip.assigntime
                    tripJson["pickuptime"] = trip.pickuptime
                    tripJson["origin"] = trip.origin
            formattedTrips.append(tripJson)
        carData[car] = {"history": formattedTrips, "spawn": totalCars[car].spawn}
    return carData
