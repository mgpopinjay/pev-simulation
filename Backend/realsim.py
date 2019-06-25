''' Fernando Sanchez, August 2017 '''
from . import sim_util as util
import heapq
import time
import random
# import datetime
import os
import json
import statistics
import math

"""
NOTES FOR THE READER:

- Use the tuning variable to manipulate the simulator
- Many of these variables will be set via front end user input
- Turn off "PRINT_ANALYTICS" to avoid large terminal outputs
- TODO: Make the data sections below
- DISABLE_SPECIFICS is a list where every data variable listed by the user will not be printed in the output
- ENABLE_SPECIFICS is the same as disable but it enables the listed data variables
    - Don't overlap these two lists, you will get unexpected results
"""

"""
TODO LIST:
- randomizer for data
- hubway clusters
- make data buckets for presenting analytics in 'real time'
- comparison study using the UAP paper
- Speed up by preprocessing hubway data in exterior file
"""

def loadVariables():
    curpath = os.path.dirname(os.path.abspath(__file__))
    sim_id = json.load(open(os.path.dirname(curpath) + "/Backend/id_counter.txt"))
    filename = "sim_inputs_"+str(sim_id)+".json"
    with open("./id_counter.txt", 'w') as infile:
        infile.write(str(sim_id + 1))
    return json.load(open(os.path.dirname(curpath)+"/Backend/Inputs/"+filename))

def populateRequests(requests, mapName, randomRatio, taxiRatio, hubwayRatio, startHr, endHr, fuzzing, maxDist):
    if mapName == "Boston":
        if randomRatio:
            requests += util.generate_random_requests(["-71.05888", "42.360082"], 50, randomRatio, startHr, endHr, 3.2, fuzzing)
        if taxiRatio:
            requests += util.generate_taxi_trips(maxDist, 0, taxiRatio, startHr, endHr, fuzzing)
        if hubwayRatio:
            res = util.generate_hubway_trips(1000, maxDist, 0, hubwayRatio, startHr, endHr, fuzzing)
            requests += res[0]

    elif mapName == "Taipei":
        if randomRatio:
            requests += util.generate_random_requests(["121.538912", "25.044209"], 50, randomRatio, startHr, endHr, 5, fuzzing)
            requests += util.generate_random_requests(["121.484580", "25.019766"], 50, randomRatio / 2, startHr, endHr, 10, fuzzing)
            requests += util.generate_random_requests(["121.469703", "25.066972"], 50, randomRatio / 2, startHr, endHr, 8, fuzzing)

    heapq.heapify(requests)  # sort requests by start time
    return requests

def assignFinishedTrip(lst, car, trip):
    if car.id in lst.keys():
        lst[car.id].append(trip)
    else:
        lst[car.id] = [trip]
    return lst

def populatePEVs(numCars, totalCars, freeCars, busyCars, mapName):
    if mapName == "Boston":
        spawnPoints = [
            util.find_snap_coordinates(util.get_snap_output(["-71.093196", "42.358296"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.088376", "42.362249"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.085130", "42.362500"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.108264", "42.350325"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.097831", "42.344706"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.088076", "42.347284"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.086029", "42.344000"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.072874", "42.355593"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.070359", "42.352096"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.066270", "42.351172"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.062733", "42.352414"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.063130", "42.354835"])),
            util.find_snap_coordinates(util.get_snap_output(["-71.100281", "42.363463"])),
        ]

    elif mapName == "Taipei":
        spawnPoints = [
            util.find_snap_coordinates(util.get_snap_output(["121.502746", "25.031213"])),
        ]

    for i in range(numCars):
        p = spawnPoints[i % len(spawnPoints)]
        car = util.PEV(i, p)
        freeCars.append(car)
        totalCars[i] = car

    heapq.heapify(busyCars)
    return freeCars

def updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests):
    if len(busyCars) == 0:
        return "No busy cars to update"
    else:
        updatedCars = []  # debug purposes
        while simTime >= busyCars[0].time:
            # end request
            car = heapq.heappop(busyCars)
            if type(car.request) == util.Request:
                doub = car.end_trip()  # doub is a tuple of (finished_trip, finished_nav)
                finished = doub[0]  # finished_trip
                finished_nav = doub[1]  # finished_nav
                assignFinishedTrip(finishedTrips, car, finished_nav)
                assignFinishedTrip(finishedTrips, car, finished)
                finishedRequests.append(finished)
                car.become_idle(finished.time+finished.pickuptime+finished.traveltime)
                freeCars.append(car)
            updatedCars.append(str(car.id))  # debug purposes

            if len(busyCars) == 0:
                break
        return "Updated the following cars: {}".format(updatedCars)

def assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips):
    tempFreeCars = rebalancingCars + freeCars
    req = heapq.heappop(requests)

    if len(tempFreeCars) > 0:
        # loop through free_cars to find the car with minimum linear distance to pickup
        minCarIndex, minCar = min(enumerate(freeCars), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        del freeCars[minCarIndex]
        idl = minCar.end_idle(req)
        idleTrips.append(idl)
        assignFinishedTrip(finishedTrips, minCar, idl)
        heapq.heappush(busyCars, minCar)  # move car to busy list
        return "Assigned request to car: {}".format(minCar.id)

    else:  # there are no free cars
        # Try implementing system where pushed back requests are not equal
        req.pushtime += 1.0  # increment time by 1 second
        req.time += 1.0  # move the request time forward until a car is free to claim it
        heapq.heappush(requests, req)
        return "Pushed back request"

def finishBusyCars(busyCars, freeCars, finishedTrips, finishedRequests):
    car = heapq.heappop(busyCars)  # get first busy car
    if type(car.request) == util.Request:
        doub = car.end_trip()
        finished = doub[0]
        finishedNav = doub[1]
        if (json.loads(finishedNav.osrm)["code"] == "Ok"):
            assignFinishedTrip(finishedTrips, car, finishedNav)
            assignFinishedTrip(finishedTrips, car, finished)
            finishedRequests.append(finished)
            car.become_idle(finished.time+finished.pickuptime+finished.traveltime)
    freeCars.append(car)
    return "Finished request for car: {}".format(car.id)

def analyzeResults(finishedRequests, freeCars, systemDelta, startHr, endHr):
    pickuptimes = []
    pushtimes = []
    waittimes = []
    traveltimes = []
    origins = {
        "taxi": 0,
        "bike": 0,
        "random": 0,
    }
    for req in finishedRequests:
        pickuptimes.append(req.pickuptime)
        pushtimes.append(req.pushtime)
        waittimes.append(req.pickuptime + req.pushtime)
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
    # print("REBALANCE ON?: "+str(REBALANCE_ON)
    # print("RANDOM START?: "+str(RANDOM_START)
    print("TOTAL TRIPS: {}".format(len(finishedRequests)))
    for origin in origins.keys():
        print(origin.upper()+" TRIPS: {}".format(origins[origin]))
    # Avg time for PEV to travel to request
    avg_req_pickup = round(statistics.mean(pickuptimes), 1)
    print("AVERAGE REQUEST PICKUPTIME: {}".format(avg_req_pickup))
    # Avg time for PEV to be assigned to request
    avg_req_assign = round(statistics.mean(pushtimes), 1)
    print("AVERAGE REQUEST PUSHTIME: {}".format(avg_req_assign))
    # Avg travel time of each request from origin to destination
    avg_req_travel = round(statistics.mean(traveltimes), 1)
    print("AVERAGE REQUEST TRAVELTIME: {}".format(avg_req_travel))
    # Avg time moving with passenger
    avg_car_travel = round(statistics.mean(utiltimes), 1)
    print("AVERAGE CAR UTILIZATION TIME: {}".format(avg_car_travel))
    # Avg time moving without passenger
    avg_car_navigate = round(statistics.mean(navtimes), 1)
    print("AVERAGE CAR NAVIGATION TIME: {}".format(avg_car_navigate))
    # Avg time spent moving
    avg_car_move = round(statistics.mean(movingtimes), 1)
    print("AVERAGE CAR MOVING TIME: {}".format(avg_car_move))
    # Percent of moving time with passenger
    percent_travel_over_move = round(avg_car_travel/avg_car_move*100, 1)
    print("AVERAGE CAR UTILIZATION PERCENTAGE: {}".format(percent_travel_over_move))
    # Avg time spent idle
    avg_car_idle = round(statistics.mean(idletimes), 1)
    print("AVERAGE CAR IDLE TIME: {}".format(avg_car_idle))
    # Percent of total time spent idle
    percent_idle_over_total = round(avg_car_idle/(avg_car_idle+avg_car_move)*100, 1)
    print("AVERAGE CAR IDLE PERCENTAGE: {}".format(percent_idle_over_total))
    # Percent of total time spent moving
    percent_move_over_total = round(avg_car_move/(avg_car_move+avg_car_idle)*100, 1)
    print("AVERAGE CAR MOVEMENT PERCENTAGE: {}".format(percent_move_over_total))

    # waitDist is the distribution of waittimes in 5 min intervals
    waitDist = [0 for i in range(math.ceil(waittimes[-1]/60/5))]
    # Place each time into bin
    for n in waittimes:
        currentBin = math.floor(n/60/5)
        waitDist[currentBin] += 1
    # Waittime analytics
    # Avg wait time
    avg_req_wait = statistics.mean(waittimes)
    print("WAITTIME AVERAGE: {}".format(avg_req_wait))
    # Request wait time 50th percentile
    wait_time_50p = waittimes[len(waittimes)//2]
    print("WAITTIME 50th PERCENTILE: {}".format(wait_time_50p))
    # Request wait time 75th percentile
    wait_time_75p = waittimes[len(waittimes)*3//4]
    print("WAITTIME 75th PERCENTILE: {}".format(wait_time_75p))
    # Request wait time distribution by 5 minute bins
    print("WAITTIME DISTRIBUTION BY 5 MIN: {}".format(waitDist))

    ''' MORE REBALANCING ANALYTICS TODO: Fix this
    print("NUM REBALANCING TRIPS: "+str(len(rebalance_trips)))
    print("TIME OF REBALANCE TRIPS: \n"+str(rebaltimes))
    print("LENGTH OF REBALANCE TRIPS: \n"+str(rebaltraveltimes))
    r_avg = reduce(lambda x,y:x+y, rebaltraveltimes)/len(rebaltraveltimes)
    print("AVERAGE LENGTH OF REBALANCE TRIP: "+str(r_avg))
    '''

    simOutputs = {
        "TRIPS": origins,
        "TRIPS_HR": round(len(finishedRequests)/(endHr-startHr), 1),
        "TRIPS_DAY": len(finishedRequests)/(endHr-startHr)*24,
        "SIM RUNTIME": str(systemDelta),
        "AVERAGE REQUEST PICKUPTIME": str(avg_req_pickup),
        "AVERAGE REQUEST PUSHTIME": str(avg_req_assign),
        "AVERAGE REQUEST TRAVELTIME": str(avg_req_travel),
        "AVERAGE CAR UTILIZATION": str(avg_car_travel),
        "AVERAGE CAR NAVIGATION": str(avg_car_navigate),
        "AVERAGE CAR MOVINGTIME": str(avg_car_move),
        "AVERAGE CAR IDLETIME": str(avg_car_idle),
        "AVERAGE CAR UTILIZATION PERCENTAGE": str(percent_travel_over_move),
        "AVERAGE CAR MOVEMENT PERCENTAGE": str(percent_move_over_total),
        "AVERAGE CAR IDLE PERCENTAGE": str(percent_idle_over_total),
        "WAITTIME AVERAGE": str(avg_req_wait),
        "WAITTIME 50th PERCENTILE": str(wait_time_50p),
        "WAITTIME 75th PERCENTILE": str(wait_time_75p),
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
            tripJson["start_time"] = trip.original_time
            tripJson["end_time"] = trip.time+trip.traveltime
            tripJson["duration"] = trip.traveltime
            tripJson["id"] = i
            tripJson["pickuptime"] = 0
            tripJson["pushtime"] = 0
            if type(trip) == util.Idle:
                tripJson["type"] = "Idle"
                tripJson["start_point"] = trip.osrm  # location listed under this name for visualizer
            else:
                tripJson["steps_polyline"] = util.parse_for_visualizer_steps(trip.osrm)
                tripJson["overview_polyline"] = util.parse_for_visualizer_whole(trip.osrm)
                tripJson["start_point"] = trip.pickup
                tripJson["end_point"] = trip.dropoff
                if type(trip) == util.Rebalance:
                    tripJson["type"] = "Rebalance"
                elif type(trip) == util.Navigation:
                    tripJson["type"] = "Navigation"
                else:
                    tripJson["end_time"] = trip.original_time+trip.traveltime+trip.pickuptime+trip.pushtime
                    tripJson["type"] = trip.kind
                    tripJson["pushtime"] = trip.pushtime
                    tripJson["pickuptime"] = trip.pickuptime
                    tripJson["origin"] = trip.origin
            formattedTrips.append(tripJson)
        carData[car] = {"history": formattedTrips, "spawn": totalCars[car].spawn}
    return carData


def runSim():
    print("running simulation...")
    variables = loadVariables()

    """
    TUNING VARIABLES
    """
    MAPSELECT   = variables["MapSelect"]
    NUMCARS     = variables["Fleet_Size"]  # number of vehicles
    CODE        = variables["Code"]  # RNG code
    RANDOM_DATA = variables["Random_Freq"]  # percentage of random trips to be generated
    HUBWAY_DATA = variables["Bike_Freq"]  # percentage of hubway data trips to be used
    TAXI_DATA   = variables["Taxi_Freq"] # percentage of taxi data
    MAX_DIST    = variables["Max_Dist"] * 1609.34
    SPAWN       = variables["Spawn_Point"]
    START_HR    = variables["Start_Hour"] # end hour of the simulation
    END_HR      = variables["End_Hour"] # start hour of the simulation

    print("NUMCARS: " + str(NUMCARS))
    print("CODE: " + str(CODE))

    NUMDATA = 1  # number of spreadsheets of data used
    KIND_RATIO = 70  # percent of trips that are passengers
    MADE_FILE = True  # make the visualizer JSON
    RANDOM_START = SPAWN
    CHARGING = False  # whether or not to use recharging model
    CHARGE_DISTANCE = MAX_DIST+util.max_stat_dist()
    CHARGE_RANGE = 15000.0
    CHARGE_TIME = 30
    REBALANCE_ON = False  # whether to rebalance
    K = 20  # number of clusters for rebalancing
    ALPHA = .1  # proportion of free cars that perform rebalancing
    PRINT_ANALYTICS = True  # whether to print final analytics
    DISABLE_SPECIFICS = []
    ENABLE_SPECIFICS = []
    FUZZING_ON = False
    SPAWN_POINT = []

    """
    THE SIMULATOR
    """
    requests = []
    finishedRequests = []
    rebalanceTrips = []  # ?
    idleTrips = []
    finishedTrips = {}
    totalCars = {}
    freeCars = []
    busyCars = []
    rebalancingCars = []

    systemStartTime = time.time()
    print("Sim Start")
    simTime = START_HR * 3600  # Set simulator to start time in secs
    simEndTime = END_HR * 3600  # Time for simulator to end

    populateRequests(requests, MAPSELECT, RANDOM_DATA, TAXI_DATA, HUBWAY_DATA, START_HR, END_HR, FUZZING_ON, MAX_DIST)
    # initiateRebalance()
    populatePEVs(NUMCARS, totalCars, freeCars, busyCars, MAPSELECT)

    while len(requests) > 0:
        # updateRebalancingCars()
        updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests)
        reqTime = requests[0].time
        if reqTime > simTime:
            simTime += 1
            continue
        assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
        # rebalanceCars()

    while len(busyCars) > 0:
        finishBusyCars(busyCars, freeCars, finishedTrips, finishedRequests)

    print("Sim Done")
    systemEndTime = time.time()
    systemDelta = systemEndTime - systemStartTime
    print("Sim Runtime: {}".format(systemDelta))
    print("Hubway Ratio: {}".format(HUBWAY_DATA))
    print("Taxi Ratio: {}".format(TAXI_DATA))
    print("Random Ratio: {}".format(RANDOM_DATA))

    """
    Create results JSON
    """
    carData = getCarData(totalCars, finishedTrips)
    simInputs = {
        "MAPSELECT": MAPSELECT,
        "NUMCARS": NUMCARS,
        "MAX_DIST": MAX_DIST,
        "KIND_RATIO": KIND_RATIO,
        "RANDOM_START": RANDOM_START,
        "SPAWN_POINT": SPAWN_POINT,
        "REBALANCE_ON": REBALANCE_ON,
        "TAXI_DATA": TAXI_DATA,
        "BIKE_DATA": HUBWAY_DATA,
        "RANDOM_DATA": RANDOM_DATA,
        "START_HR": START_HR,
        "END_HR": END_HR
    }
    simOutputs = analyzeResults(finishedRequests, freeCars, systemDelta, START_HR, END_HR)

    finalData = {}
    finalData["fleet"] = carData
    finalData["inputs"] = simInputs
    finalData["outputs"] = simOutputs

    if MADE_FILE:
        filename = "sim_results_"+str(CODE)+".JSON"
        util.send_to_visualizer(finalData, filename)
        print("Made file")
    print("DONE")
    return finalData

if __name__ == '__main__':
    runSim()
