''' Fernando Sanchez, August 2017 '''
from . import sim_util as util
from .sim_assign import updateRequests
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
        print(p)
        car = util.PEV(i, p)
        freeCars.append(car)
        totalCars[i] = car

    heapq.heapify(busyCars)
    return freeCars

def updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests):
    if len(busyCars) == 0:
        return "No busy cars to update"
    updatedCars = []  # debug purposes
    while simTime >= busyCars[0].time:
        # end request
        car = heapq.heappop(busyCars)
        if type(car.request) == util.Request:
            doub = car.end_trip()  # doub is a tuple of (finished_trip, finished_nav)
            finished = doub[0]  # finished_trip
            finished_nav = doub[1]  # finished_nav
            util.assignFinishedTrip(finishedTrips, car, finished_nav)
            util.assignFinishedTrip(finishedTrips, car, finished)
            finishedRequests.append(finished)
            car.become_idle(finished.time+finished.pickuptime+finished.traveltime)
            freeCars.append(car)
        updatedCars.append(str(car.id))  # debug purposes

        if len(busyCars) == 0:
            break
    return "Updated the following cars: {}".format(updatedCars)

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
    print("Total Trips: {}".format(len(finishedRequests)))
    for origin in origins.keys():
        print(origin.upper()+" trips: {}".format(origins[origin]))
    # Avg time for PEV to travel to request
    avgReqPickup = round(statistics.mean(pickuptimes), 1)
    print("Average Request Pickup Time: {}".format(avgReqPickup))
    # Avg time for PEV to be assigned to request
    avgReqAssign = round(statistics.mean(pushtimes), 1)
    print("Average Request Push Time: {}".format(avgReqAssign))
    # Avg travel time of each request from origin to destination
    avgReqTravel = round(statistics.mean(traveltimes), 1)
    print("Average Request Travel Time: {}".format(avgReqTravel))
    # Avg time moving with passenger
    avgCarTravel = round(statistics.mean(utiltimes), 1)
    print("Average Car Utilization Time: {}".format(avgCarTravel))
    # Avg time moving without passenger
    avgCarNavigate = round(statistics.mean(navtimes), 1)
    print("Average Car Navigation Time: {}".format(avgCarNavigate))
    # Avg time spent moving
    avgCarMove = round(statistics.mean(movingtimes), 1)
    print("Average Car Moving Time: {}".format(avgCarMove))
    # Percent of moving time with passenger
    percentTravelOverMove = round(avgCarTravel/avgCarMove*100, 1)
    print("Average Car Utilization Percentage: {}".format(percentTravelOverMove))
    # Avg time spent idle
    avgCarIdle = round(statistics.mean(idletimes), 1)
    print("Average Car Idle Time: {}".format(avgCarIdle))
    # Percent of total time spent idle
    percentIdleOverTotal = round(avgCarIdle/(avgCarIdle+avgCarMove)*100, 1)
    print("Average Car Idle Percentage: {}".format(percentIdleOverTotal))
    # Percent of total time spent moving
    percentMoveOverTotal = round(avgCarMove/(avgCarMove+avgCarIdle)*100, 1)
    print("Average Car Movement Percentage: {}".format(percentMoveOverTotal))

    # waitDist is the distribution of waittimes in 5 min intervals
    waitDist = [0 for i in range(math.ceil(waittimes[-1]/60/5))]
    # Place each time into bin
    for n in waittimes:
        currentBin = math.floor(n/60/5)
        waitDist[currentBin] += 1
    # Waittime analytics
    # Avg wait time
    avgReqWait = statistics.mean(waittimes)
    print("Average Wait Time: {}".format(avgReqWait))
    # Request wait time 50th percentile
    waitTime50p = waittimes[len(waittimes)//2]
    print("50th Percentile Wait Time: {}".format(waitTime50p))
    # Request wait time 75th percentile
    waitTime75p = waittimes[len(waittimes)*3//4]
    print("75th Percentile Wait Time: {}".format(waitTime75p))
    # Request wait time distribution by 5 minute bins
    print("Distribution of Wait Times by 5 min: {}".format(waitDist))

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
        "AVERAGE REQUEST PICKUPTIME": str(avgReqPickup),
        "AVERAGE REQUEST PUSHTIME": str(avgReqAssign),
        "AVERAGE REQUEST TRAVELTIME": str(avgReqTravel),
        "AVERAGE CAR UTILIZATION": str(avgCarTravel),
        "AVERAGE CAR NAVIGATION": str(avgCarNavigate),
        "AVERAGE CAR MOVINGTIME": str(avgCarMove),
        "AVERAGE CAR IDLETIME": str(avgCarIdle),
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
    print("Map Name: {}".format(MAPSELECT))
    NUMCARS     = variables["Fleet_Size"]  # number of vehicles
    CODE        = variables["Code"]  # RNG code
    RANDOM_DATA = variables["Random_Freq"]  # percentage of random trips to be generated
    HUBWAY_DATA = variables["Bike_Freq"]  # percentage of hubway data trips to be used
    TAXI_DATA   = variables["Taxi_Freq"] # percentage of taxi data
    MAX_DIST    = variables["Max_Dist"] * 1609.34
    SPAWN       = variables["Spawn_Point"]
    START_HR    = variables["Start_Hour"] # end hour of the simulation
    END_HR      = variables["End_Hour"] # start hour of the simulation

    print("Number of cars: " + str(NUMCARS))
    print("Code: " + str(CODE))

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
    FUZZING_ON = True
    SPAWN_POINT = []

    """
    THE SIMULATOR
    """
    simRunning = True
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

    while simRunning:
        # updateRebalancingCars()
        updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests)
        updateRequests(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
        # rebalanceCars()
        simTime += 1
        if simTime > simEndTime and len(requests) == 0 and len(busyCars) == 0:
            simRunning = False

    # while len(requests) > 0:
    #     # updateRebalancingCars()
    #     updateBusyCars(busyCars, freeCars, simTime, finishedTrips, finishedRequests)
    #     reqTime = requests[0].time
    #     if reqTime > simTime:
    #         simTime += 1
    #         continue
    #     assignRequest(freeCars, rebalancingCars, busyCars, simTime, requests, finishedTrips, idleTrips)
    #     # rebalanceCars()

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
