''' Fernando Sanchez, August 2017 '''
import sim_util as util
import heapq
import time
import random
import datetime
import os
import json

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
    print "running simulation..."
    curpath = os.path.dirname(os.path.abspath(__file__))

    sim_id = json.load(open(os.path.dirname(curpath) + "/Backend/id_counter.txt"))
    filename = "Variable_"+str(sim_id)+".json"
    # with open("./id_counter.txt", 'w') as infile:
    # infile.write(str(sim_id + 1))

    variables = json.load(open(os.path.dirname(curpath)+"/Backend/Inputs/"+filename))

    """
    TUNING VARIABLES
    """
    NUMCARS = variables["Fleet_Size"]  # number of vehicles
    CODE = variables["Code"]  # RNG code
    print "NUMCARS: " + str(NUMCARS)
    print "CODE: " + str(CODE)

    NUMDATA = 1  # number of spreadsheets of data used
    MAX_DIST = 3000.0  # maximum trip distance in meters
    KIND_RATIO = 70  # percent of trips that are passengers
    MADE_FILE = True  # make the visualizer JSON
    HUBWAY_DATA = True  # whether to generate requests using hubway data
    RANDOM_START = True  # whether to randomly start cars around initial cluster points not using hubway data)
    SPAWN_POINT = util.find_snap_coordinates(util.get_snap_output(["-71.0873", "42.3604"]))  # lat/long of car depot (Media Lab)
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

    """
    THE SIMULATOR
    """
    sim_start_time = time.time()
    print "Sim Start"

    ''' populate requests '''
    requests = []
    stations = []
    requests = util.random_requests(["-71.05888", "42.360082"], 0, 40)

    if HUBWAY_DATA:
        res = util.generate_hubway_trips(NUMDATA*200, MAX_DIST, KIND_RATIO)
        # requests = res[0]
        stations = res[1]
    # else:
    #     requests = util.populate_requests(NUMDATA, MAX_DIST, KIND_RATIO)
    heapq.heapify(requests)
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
            p = util.find_snap_coordinates(util.get_snap_output(util.gaussian_randomizer_half_mile(stations[node[0]])))
        else:
            p = SPAWN_POINT
        car = util.PEV(i, p)
        free_cars.append(car)
        total_cars[i] = car
    busy_cars = []
    rebalancing_cars = []  # pseudo free cars
    heapq.heapify(busy_cars)

    ''' sim logic '''
    while requests:
        req_time = requests[0].time
        temp_free_cars = []
        # update rebalancing cars to add temp cars them to temp_free_cars
        if rebalancing_cars:
            print 'REBALANCING'
            for car in rebalancing_cars:
                if car.time <= req_time:
                    # end rebalancing trip
                    ind = rebalancing_cars.index(car)
                    rebalancing_cars.pop(ind)  # remove the car
                    reb = car.end_rebalance()  # then update the car (very important it is done in this order)
                    assign_finished_trip(car, reb)
                    rebalance_trips.append(reb)
                    car.become_idle(finished.time+finished.waittime+finished.traveltime)  # update car
                    free_cars.append(car)  # then add to list (very important it is done in this order)
                else:
                    # update for rebalance assignment
                    start_time = car.request.time
                    elapsed = req_time - start_time
                    route = car.request.osrm
                    loc = util.find_leg_loc(route, elapsed)  # use time elapsed to find where the car is using legs/steps data
                    car.pos = loc
        # update busy cars to be free
        if busy_cars:
            while req.time >= busy_cars[0].time:
                # end request trip
                car = heapq.heappop(busy_cars)
                if type(car.request) == util.Request:
                    doub = car.end_trip()  # doub is a tuple of (finished_trip, finished_nav)
                    finished = doub[0]
                    finished_nav = doub[1]
                    assign_finished_trip(car, finished_nav)
                    assign_finished_trip(car, finished)
                    finished_requests.append(finished)
                    if REBALANCE_ON:
                        rebal.points.append([float(finished.pickup[0]), float(finished.pickup[1])])  # add pickup point to rebalancing data structure
                    car.become_idle(finished.time+finished.waittime+finished.traveltime)
                    free_cars.append(car)
                elif type(car.request) == util.Recharge:
                    doub = car.end_recharge
                    finished = doub[0]
                    finished_idle = doub[1]
                    assign_finished_trip(car, finished_idle)
                    assign_finished_trip(car, finished)
                    # in ending rechage we become idle
                    free_cars.append(car)
                if len(busy_cars) == 0:
                    break
        # check if cars need to recharge
        if CHARGING == True:
            if free_cars:
                for car in free_cars:
                    if car.low_power(CHARGE_DISTANCE):
                        ind = free_cars.index(car)
                        free_cars.pop(ind)
                        station = util.find_closest_station(car.loc)
                        car.fulfill_recharge(util.Recharge(req_time, car.loc, station, CHARGE_TIME))
                        heapq.heappush(busy_cars, car)

        ########################
        ##### ASSIGNMENT #######
        ########################
        temp_free_cars = rebalancing_cars + free_cars
        req = heapq.heappop(requests)
        if len(temp_free_cars) > 0:
            min_pair = min(enumerate(free_cars), key=lambda pair: util.dist(pair[1].pos, req.pickup))
            min_car_index = min_pair[0]
            min_car = min_pair[1]
            del free_cars[min_car_index]
            idl = min_car.end_idle(req)
            idle_trips.append(idl)
            assign_finished_trip(min_car, idl)
            heapq.heappush(busy_cars, min_car)

            # elif min_car in rebalancing_cars:
            #     j = rebalancing_cars.index(min_car)
            #     del rebalancing_cars[j]
            #     temp_rebalance = util.Rebalance(min_car.request.time, min_car.request.pickup, min_car.pos, True)  # keep track of the rebalancing the car did before it took this request
            #     min_car.movingtime += temp_rebalance.traveltime
            #     assign_finished_trip(min_car, temp_rebalance)
            #     min_car.update_rebalance(req)
            #     heapq.heappush(busy_cars, min_car)
        else:  # there are no free cars
            req.pushtime += 1.0
            req.time += 1.0  # move the request time forward until a car is free to claim it
            heapq.heappush(requests, req)

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
                            r = util.Rebalance(req_time, car.pos, cell)
                            if r.traveltime != 0:
                                free_cars.pop(ind)
                                idl = car.end_idle(r)
                                idle_trips.append(idl)
                                assign_finished_trip(car, idl)
                                rebalancing_cars.append(car)

    ''' finish trips after all requests were fulfilled '''
    last_time = 0
    while busy_cars:
        car = heapq.heappop(busy_cars)
        if type(car.request) == util.Request:
            doub = car.end_trip()
            finished = doub[0]
            finished_nav = doub[1]
            if (json.loads(finished_nav.osrm)["code"] == "Ok"):
                assign_finished_trip(car, finished_nav)
                assign_finished_trip(car, finished)
                finished_requests.append(finished)
                if len(busy_cars) == 0:
                    last_time = car.time
                car.become_idle(finished.time+finished.waittime+finished.traveltime)
        free_cars.append(car)

    print "Sim Done"
    sim_end_time = time.time()

    """
    ANALYZE RESULTS
    """
    # runtime
    delta = sim_end_time - sim_start_time
    print "SIM RUNTIME: "+str(delta)
    # trip analytics
    waittimes = []
    pushtimes = []
    traveltimes = []
    for req in finished_requests:
        waittimes.append(round(req.waittime, 1)+round(req.pushtime, 1))
        pushtimes.append(round(req.pushtime, 1))
        traveltimes.append(round(req.traveltime, 1))
    # car analytics
    movingtimes = []
    idletimes = []
    utiltimes = []
    for car in free_cars:
        movingtimes.append(round(car.movingtime, 1))
        idletimes.append(round(car.idletime, 1))
        utiltimes.append(round(car.utiltime, 1))

    ''' REBALANCING ANALYTICS TODO: Fix this
        rebaltimes = []
        rebaltraveltimes = []
        for re in rebalance_trips:
            time_as_hour = '0'+str(int(re.time)/60)+':'+str(int(re.time)%60)
            rebaltimes.append(time_as_hour)
            rebaltraveltimes.append(re.traveltime)
    '''
    # print "HUBWAY DATA?: "+str(HUBWAY_DATA)
    # print "REBALANCE ON?: "+str(REBALANCE_ON)
    # print "RANDOM START?: "+str(RANDOM_START)
    # print "NUM CARS: "+str(NUMCARS)
    # print "NUM TRIPS: "+str(len(waittimes))
    # print "WAITTIMES: \n"+str(waittimes)
    # print "REQUEST TRAVELTIMES \n"+str(traveltimes)
    avg = reduce(lambda x, y: x+y, waittimes)/len(waittimes)
    print "AVERAGE REQUEST WAITTIME: "+str(avg)
    p_avg = reduce(lambda x, y: x+y, pushtimes)/len(pushtimes)
    print "AVERAGE REQUEST PUSHTIME: "+str(p_avg)
    t_avg = reduce(lambda x, y: x+y, traveltimes)/len(traveltimes)
    print "AVERAGE REQUEST TRAVELTIME: "+str(t_avg)
    perc = float(p_avg)/float(avg)
    print "AVERAGE REQUEST PUSHTIME PROPORTION: "+str(perc)
    u_avg = reduce(lambda x, y: x+y, utiltimes)/len(utiltimes)
    print "AVERAGE CAR UTILIZATION: "+str(u_avg)
    m_avg = reduce(lambda x, y: x+y, movingtimes)/len(movingtimes)
    print "AVERAGE CAR MOVINGTIME: "+str(m_avg)
    prop = float(u_avg)/float(m_avg)
    print "AVERAGE CAR UTILIZATION PROPORTION: "+str(prop)
    i_avg = reduce(lambda x, y: x+y, idletimes)/len(idletimes)
    print "AVERAGE CAR IDLETIME: "+str(i_avg)

    ''' MORE REBALANCING ANALYTICS TODO: Fix this
    print "NUM REBALANCING TRIPS: "+str(len(rebalance_trips))
    print "TIME OF REBALANCE TRIPS: \n"+str(rebaltimes)
    print "LENGTH OF REBALANCE TRIPS: \n"+str(rebaltraveltimes)
    r_avg = reduce(lambda x,y:x+y, rebaltraveltimes)/len(rebaltraveltimes)
    print "AVERAGE LENGTH OF REBALANCE TRIP: "+str(r_avg)
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
            trip_json["waittime"] = 0
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
                    trip_json["end_time"] = trip.time+trip.traveltime+trip.waittime+trip.pushtime
                    trip_json["type"] = trip.kind
                    trip_json["pushtime"] = trip.pushtime
                    trip_json["waittime"] = trip.waittime
            formatted_trips.append(trip_json)
        car_data[car] = {"history": formatted_trips, "spawn": total_cars[car].spawn}

    ''' retrieve sim/results data '''
    ''' TODO: fill rebalancing stats '''
    analytics = {}
    sim_data = {
        "NUMCARS": NUMCARS,
        "NUMDATA": NUMDATA,
        "MAX_DIST": MAX_DIST,
        "KIND_RATIO": KIND_RATIO,
        "RANDOM_START": RANDOM_START,
        "SPAWN_POINT": SPAWN_POINT,
        "REBALANCE_ON": REBALANCE_ON,
        "K": K,
        "ALPHA": ALPHA
    }
    sim_results = {
        "NUMTRIPS": str(len(waittimes)),
        "SIM RUNTIME": str(delta),
        "AVERAGE REQUEST WAITTIME": str(avg),
        "AVERAGE REQUEST PUSHTIME": p_avg,
        "AVERAGE CAR UTILIZATION": str(u_avg),
        "AVERAGE CAR MOVINGTIME": str(m_avg),
        "AVERAGE REQUEST TRAVELTIME": str(t_avg),
        "AVERAGE REQUEST PUSHTIME PROPORTION": str(perc),
        "AVERAGE CAR UTILIZATION PROPORTION": str(prop),
        "AVERAGE CAR IDLETIME": str(i_avg)
    }
    rebal_results = {}
    analytics["parameters"] = sim_data
    analytics["results"] = sim_results
    analytics["rebalancing reults"] = rebal_results

    # final data diction to make into JSON
    final_data = {}
    final_data["fleet"] = car_data
    final_data["analytics"] = analytics

    # create final datafile
    if MADE_FILE:
        # print CODE
        filename = "trial_sim_hubway_data_"+str(CODE)+".JSON"
        util.send_to_visualizer(final_data, filename)
        # print final_data["fleet"][0]["history"]
        print "Made file"
    print "DONE"
    return final_data

if __name__ == '__main__':
    run_sim()
