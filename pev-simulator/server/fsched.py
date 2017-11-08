## TODO an algorithm for assigning a task to a fleet
## Should run on-line (that is, without knowledge of
## upcoming tasks)
import fleet
from sets import Set
import sim_util
import routes

def linearSpeedEst(a, b):
    ## distance estimate based on 3 m/s movement of straight-line distance
    return int(sim_util.ll_dist_m(a, b) / 3)

def nilHeuristic(a, b):
    return 0

def perfectHeuristic(a, b):
    rte = routes.RouteFinder().get_dirs(a, b)
    if rte:
        return rte.getDuration()
    else:
        return 99999


def assign(time, task, fleet):
    hst = linearSpeedEst
    illegal = Set([])
    while len(illegal) < len(fleet.vehicles):
        assignee = None
        for pev in fleet:
            if not pev.getUID() in illegal:
                if assignee is None:
                    assignee = pev
                elif pev.soonestArrivalAfter(time, task.getPickupLoc(),
                                             heuristic = hst) < assignee.soonestArrivalAfter(
                                                 time, task.getPickupLoc(), heuristic = hst):
                    assignee = pev
        try:
            wait_time = assignee.assign(task, time)
            task.setPickup(wait_time)
            return (assignee.getUID(), wait_time)
        except:
            illegal.add(assignee.getUID())
    raise Exception("Simulation died - no vehicles could accept task " + str(task))
