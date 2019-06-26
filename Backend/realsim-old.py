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


def run_sim():
    print("running simulation...")
    curpath = os.path.dirname(os.path.abspath(__file__))

    sim_id = json.load(open(os.path.dirname(curpath) + "/Backend/id_counter.txt"))
    filename = "sim_inputs_"+str(sim_id)+".json"
    with open("./id_counter.txt", 'w') as infile:
        infile.write(str(sim_id + 1))

    variables = json.load(open(os.path.dirname(curpath)+"/Backend/Inputs/"+filename))

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
    sim_sys_start_time = time.time()
    print("Sim Start")
    sim_time = START_HR * 3600  # Set simulator to start time in secs
    sim_end_time = END_HR * 3600  # Time for simulator to end

    ''' populate requests '''
    requests = []
    stations = []

    if MAPSELECT == "Boston":
        SPAWN_POINT = [
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
        if RANDOM_DATA:
            requests += util.generate_random_requests(["-71.05888", "42.360082"], 50, RANDOM_DATA, START_HR, END_HR, 3.2, FUZZING_ON)
        if TAXI_DATA:
            requests += util.generate_taxi_trips(MAX_DIST, 0, TAXI_DATA, START_HR, END_HR, FUZZING_ON)
        if HUBWAY_DATA:
            res = util.generate_hubway_trips(1000, MAX_DIST, 0, HUBWAY_DATA, START_HR, END_HR, FUZZING_ON)
            requests += res[0]
            stations = res[1]

    elif MAPSELECT == "Taipei":
        SPAWN_POINT = [util.find_snap_coordinates(util.get_snap_output(["121.502746", "25.031213"]))]
        if RANDOM_DATA:
            requests += util.generate_random_requests(["121.538912", "25.044209"], 50, RANDOM_DATA, START_HR, END_HR, 5, FUZZING_ON)
            requests += util.generate_random_requests(["121.484580", "25.019766"], 50, RANDOM_DATA / 2, START_HR, END_HR, 10, FUZZING_ON)
            requests += util.generate_random_requests(["121.469703", "25.066972"], 50, RANDOM_DATA / 2, START_HR, END_HR, 8, FUZZING_ON)

    heapq.heapify(requests)  # sort requests by start time
    finished_requests = []
    rebalance_trips = []
    idle_trips = []
    finished_trips = {}  # all trips keyed by which car took that trip

    def assign_finished_trip(car, trip):
        if car.id in finished_trips.keys():
            finished_trips[car.id].append(trip)
        else:
            finished_trips[car.id] = [trip]

            ''' rebalancing data '''
    if REBALANCE_ON:
        rebal = util.RebalanceData(23, K)  # 23 is last hour of data
        mean_clust = rebal.find_centers()  # initial clustering
    else:
        rebal = None

    ''' populate PEVs '''
    total_cars = {}  # all car object keyed by ID
    free_cars = []  # these are truly free/idle cars (have no request or rebalance ongoing)
    for i in range(NUMCARS):  # 'i' is car ID
        if RANDOM_START:
            node = random.sample(stations.keys(), 1)  # make cars spawn randomly at clusters
            p = util.find_snap_coordinates(util.get_snap_output(util.gaussian_randomizer(stations[node[0]], 0.8, FUZZING_ON)))
        else:
            p = SPAWN_POINT[i % len(SPAWN_POINT)]
        car = util.PEV(i, p)
        free_cars.append(car)
        total_cars[i] = car
    busy_cars = []
    rebalancing_cars = []  # pseudo free cars
    heapq.heapify(busy_cars)

    ''' sim logic '''
    while requests:
        temp_free_cars = []
        # update rebalancing cars to add temp cars them to temp_free_cars
        if rebalancing_cars:
            print('REBALANCING')
            for car in rebalancing_cars:
                if car.time <= sim_time:
                    # end rebalancing trip
                    ind = rebalancing_cars.index(car)
                    rebalancing_cars.pop(ind)  # remove the car
                    reb = car.end_rebalance()  # then update the car (very important it is done in this order)
                    assign_finished_trip(car, reb)
                    rebalance_trips.append(reb)
                    car.become_idle(finished.time+finished.pickuptime+finished.traveltime)  # update car
                    free_cars.append(car)  # then add to list (very important it is done in this order)
                else:
                    # update for rebalance assignment
                    start_time = car.request.time
                    elapsed = sim_time - start_time
                    route = car.request.osrm
                    loc = util.find_leg_loc(route, elapsed)  # use time elapsed to find where the car is using legs/steps data
                    car.pos = loc
        # update busy cars to be free
        if busy_cars:
            while sim_time >= busy_cars[0].time:
                # end request trip
                car = heapq.heappop(busy_cars)
                # car = busy_cars[0]
                # busy_cars.pop(0)
                if type(car.request) == util.Request:
                    doub = car.end_trip()  # doub is a tuple of (finished_trip, finished_nav)
                    finished = doub[0]  # finished_trip
                    finished_nav = doub[1]  # finished_nav
                    assign_finished_trip(car, finished_nav)
                    assign_finished_trip(car, finished)
                    finished_requests.append(finished)
                    if REBALANCE_ON:
                        rebal.points.append([float(finished.pickup[0]), float(finished.pickup[1])])  # add pickup point to rebalancing data structure
                    car.become_idle(finished.time+finished.pickuptime+finished.traveltime)
                    free_cars.append(car)
                elif type(car.request) == util.Recharge:
                    doub = car.end_recharge
                    finished = doub[0]  # finished_trip
                    finished_idle = doub[1]  # finished_nav
                    assign_finished_trip(car, finished_idle)
                    assign_finished_trip(car, finished)
                    # in ending rechage we become idle
                    free_cars.append(car)
                if len(busy_cars) == 0:
                    break
        # check if cars need to recharge
        if CHARGING is True:
            if free_cars:
                for car in free_cars:
                    if car.low_power(CHARGE_DISTANCE):
                        ind = free_cars.index(car)
                        free_cars.pop(ind)
                        station = util.find_closest_station(car.loc)
                        car.fulfill_recharge(util.Recharge(sim_time, car.loc, station, CHARGE_TIME))
                        heapq.heappush(busy_cars, car)  # turn free car into busy car

        ########################
        ##### ASSIGNMENT #######
        ########################
        temp_free_cars = rebalancing_cars + free_cars
        req_time = requests[0].time
        if req_time > sim_time:
            sim_time += 1
            continue

        req = heapq.heappop(requests)
        # req = requests[0]
        # requests.pop(0)

        if len(temp_free_cars) > 0:
            # loop through free_cars to find the car with minimum linear distance to pickup
            min_pair = min(enumerate(free_cars), key=lambda pair: util.dist(pair[1].pos, req.pickup))
            # min_pair = (index, car)
            min_car_index = min_pair[0]
            min_car = min_pair[1]
            # print("Assigned request to car: {}".format(min_car.id))
            del free_cars[min_car_index]
            idl = min_car.end_idle(req)
            idle_trips.append(idl)
            assign_finished_trip(min_car, idl)
            heapq.heappush(busy_cars, min_car)  # move car to busy list
            # busy_cars.append(min_car)

            # elif min_car in rebalancing_cars:
            #     j = rebalancing_cars.index(min_car)
            #     del rebalancing_cars[j]
            #     temp_rebalance = util.Rebalance(min_car.request.time, min_car.request.pickup, min_car.pos, True)  # keep track of the rebalancing the car did before it took this request
            #     min_car.movingtime += temp_rebalance.traveltime
            #     assign_finished_trip(min_car, temp_rebalance)
            #     min_car.update_rebalance(req)
            #     heapq.heappush(busy_cars, min_car)

        else:  # there are no free cars
            req.pushtime += 1.0  # increment time by 1 second
            req.time += 1.0  # move the request time forward until a car is free to claim it
            heapq.heappush(requests, req)
            # requests.append(req)

        ''' rebalancing logic '''
        ''' TODO: fix this and comment the logic '''
        if REBALANCE_ON:
            if free_cars:
                if len(rebalancing_cars) < int(NUMCARS*ALPHA):
                    n = len(free_cars)
                    choose = int(n*ALPHA)
                    if choose != 0 and choose < n:
                        cells = rebal.find_centers()[0]
                        inds = random.sample(range(len(free_cars)-choose), choose)
                        for ind in inds:
                            ce = random.sample(cells, 1)
                            cell = util.find_snap_coordinates(util.get_snap_output([str(ce[0][0]), str(ce[0][1])]))
                            r = util.Rebalance(sim_time, car.pos, cell)
                            if r.traveltime != 0:
                                free_cars.pop(ind)
                                idl = car.end_idle(r)
                                idle_trips.append(idl)
                                assign_finished_trip(car, idl)
                                rebalancing_cars.append(car)

    ''' finish trips after all requests were fulfilled '''
    # last_time = 0
    while busy_cars:
        car = heapq.heappop(busy_cars)  # get first busy car
        # car = busy_cars[0]
        # busy_cars.pop(0)
        if type(car.request) == util.Request:
            doub = car.end_trip()
            finished = doub[0]
            finished_nav = doub[1]
            if (json.loads(finished_nav.osrm)["code"] == "Ok"):
                assign_finished_trip(car, finished_nav)
                assign_finished_trip(car, finished)
                finished_requests.append(finished)
                # if len(busy_cars) == 0:
                #      last_time = car.time
                car.become_idle(finished.time+finished.pickuptime+finished.traveltime)
        free_cars.append(car)

    print("Sim Done")
    sim_sys_end_time = time.time()

    """
    ANALYZE RESULTS
    """
    # runtime
    delta = sim_sys_end_time - sim_sys_start_time
    print("SIM RUNTIME: "+str(delta))
    # trip analytics
    pickuptimes = []
    pushtimes = []
    waittimes = []
    traveltimes = []
    origins = {
        "taxi": 0,
        "bike": 0,
        "random": 0,
    }
    for req in finished_requests:
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
    for car in free_cars:
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
    print("HUBWAY DATA: {}".format(HUBWAY_DATA))
    print("TAXI DATA: {}".format(TAXI_DATA))
    print("RANDOM DATA: {}".format(RANDOM_DATA))

    # CALCULATE ANALYTICS
    # print("REBALANCE ON?: "+str(REBALANCE_ON)
    # print("RANDOM START?: "+str(RANDOM_START)
    print("TOTAL TRIPS: {}".format(len(finished_requests)))
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

    """
    Create results JSON
    """
    ''' retrieve fleet data '''
    car_data = {}
    for car in total_cars:
        car_data[car] = {"history": [], "spawn": total_cars[car].spawn}
    for car in finished_trips.keys():
        trips = finished_trips[car]
        formatted_trips = []
        for i in range(len(trips)):
            trip = trips[i]
            trip_json = {}
            trip_json["start_time"] = trip.original_time
            trip_json["end_time"] = trip.time+trip.traveltime
            trip_json["duration"] = trip.traveltime
            trip_json["id"] = i
            trip_json["pickuptime"] = 0
            trip_json["pushtime"] = 0
            if type(trip) == util.Idle:
                trip_json["type"] = "Idle"
                trip_json["start_point"] = trip.osrm  # location listed under this name for visualizer
            else:
                trip_json["steps_polyline"] = util.parse_for_visualizer_steps(trip.osrm)
                trip_json["overview_polyline"] = util.parse_for_visualizer_whole(trip.osrm)
                trip_json["start_point"] = trip.pickup
                trip_json["end_point"] = trip.dropoff
                if type(trip) == util.Rebalance:
                    trip_json["type"] = "Rebalance"
                elif type(trip) == util.Navigation:
                    trip_json["type"] = "Navigation"
                else:
                    trip_json["end_time"] = trip.original_time+trip.traveltime+trip.pickuptime+trip.pushtime
                    trip_json["type"] = trip.kind
                    trip_json["pushtime"] = trip.pushtime
                    trip_json["pickuptime"] = trip.pickuptime
                    trip_json["origin"] = trip.origin
            formatted_trips.append(trip_json)
        car_data[car] = {"history": formatted_trips, "spawn": total_cars[car].spawn}

    ''' retrieve sim/results data '''
    sim_inputs = {
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



    rebal_results = {}

    # final data diction to make into JSON
    final_data = {}
    final_data["fleet"] = car_data
    final_data["inputs"] = sim_inputs
    final_data["outputs"] = sim_outputs

    if MADE_FILE:
        filename = "sim_results_"+str(CODE)+".JSON"
        util.send_to_visualizer(final_data, filename)
        print("Made file")
    print("DONE")
    return final_data


if __name__ == '__main__':
    run_sim()
