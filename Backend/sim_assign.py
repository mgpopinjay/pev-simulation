import heapq
from . import sim_util as util

def assignRequest(simTime, timeStep, cars, requests, logs):
    tempFreeCars = cars['rebalancingCars'] + cars['freeCars']
    req = heapq.heappop(requests)

    if len(tempFreeCars) > 0:
        # loop through free_cars to find the car with minimum linear distance to pickup
        minCarIndex, minCar = min(enumerate(cars['freeCars']), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        del cars['freeCars'][minCarIndex]
        minCar.update(simTime, logs['finishedTrips'], idleTrips=logs['idleTrips'], req=req)
        heapq.heappush(cars['navCars'], minCar)  # move car to busy list
        return "Assigned request to car: {}".format(minCar.id)

    else:  # there are no free cars
        # Try implementing system where pushed back requests are not equal
        req.assigntime += timeStep  # increment time by 1 second
        req.time += timeStep  # move the request time forward until a car is free to claim it
        heapq.heappush(requests, req)
        return "Pushed back request"

def updateRequests(simTime, timeStep, cars, requests, logs):
    count = 0
    while len(requests) > 0:
        req = requests[0]
        if req.time <= simTime:
            assignRequest(simTime, timeStep, cars, requests, logs)
            count += 1
        else:
            break
    return "Assigned {} requests".format(count)


assignMethods = {"closestCar": updateRequests}
