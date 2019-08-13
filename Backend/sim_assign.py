import heapq
from . import sim_util as util
import logging
logging.basicConfig(level=logging.INFO, format='%(%(levelname)s - %(message)s')

def assignRequest(simTime, timeStep, cars, requests, logs):
    for car in cars['rebalancingCars']:
        car.updateLocation(simTime)
    tempFreeCars = len(cars['rebalancingCars']) + len(cars['freeCars'])
    req = heapq.heappop(requests)
    minCarIndexF, minCarF, minCarIndexR, minCarR = (None, None, None, None)
    # fix this with a remove function instead of del
    if tempFreeCars > 0:
        # loop through free_cars to find the car with minimum linear distance to pickup
        if len(cars['freeCars']) > 0:
            minCarIndexF, minCarF = min(enumerate(cars['freeCars']), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        if len(cars['rebalancingCars']) > 0:
            minCarIndexR, minCarR = min(enumerate(cars['rebalancingCars']), key=lambda pair: util.dist(pair[1].pos, req.pickup))
        if minCarIndexF and minCarIndexR:
            if util.dist(minCarF.pos, req.pickup) <= util.dist(minCarR.pos, req.pickup):
                minCar = minCarF
                del cars['freeCars'][minCarIndexF]
            else:
                minCar = minCarR
                del cars['rebalancingCars'][minCarIndexR]
        elif minCarIndexF:
            minCar = minCarF
            del cars['freeCars'][minCarIndexF]
        elif minCarIndexR:
            minCar = minCarR
            del cars['rebalancingCars'][minCarIndexR]
        prevState = minCar.state
        resp = minCar.update(simTime, logs['finishedTrips'], idleTrips=logs['idleTrips'], req=req)
        logging.debug(f"Car {str(minCar.id).zfill(4)}: {prevState} -> {resp}")
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
