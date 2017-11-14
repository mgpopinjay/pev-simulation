#!/usr/bin/env python
## TODO a test case

import tripgen
import pev_sim
import pprint
import sim_util
import routes

import json

routes.RouteFinder("google_api_key", "route_cache")

env_all = pev_sim.Sim_env(3, None, [(42.3492699,-71.0900377)])
env_inc = pev_sim.Sim_env(3, None, [(42.3492699,-71.0900377)])

testdata = tripgen.readNewburyTestData()

for t in testdata:
	print " ".join(["Trip", str(t.getID()), "Time", str(t.getTimeOrdered()), "Pickup:", str(t.getPickupLoc()), "Dropoff", str(t.getDest())])

env_all.scheduleAll(testdata)

itv = 1800
for i in xrange(0, 86400, itv):
	print "Incremental scheduling of", i, i+itv
	rng = [i, i + itv]
	sgt = [t for t in testdata if (rng[0] <= t.getTimeOrdered() and t.getTimeOrdered() < rng[1])]
	env_inc.scheduleIncremental(sgt, itv)

for i in xrange(3):
	v_a = env_all.fleet.vehicles[i]
	v_i = env_all.fleet.vehicles[i]
	if not v_a.spawn == v_i.spawn:
		print "fail"
	if not v_a.loc == v_i.loc:
		print "fail"
	if not v_a.uid == v_i.uid:
		print "fail"
	if not v_a.current == v_i.current:
		print "fail"
	if not len(v_a.history) == len(v_i.history):
		print "fail"
	for j in xrange(v_a.current):
		h_i = v_i.history[j]
		h_a = v_a.history[j]
		if not h_i.kind == h_a.kind:
			print "fail"
		if not h_i.start == h_a.start:
			print "fail"
		if not h_i.end == h_a.end:
			print "fail"

env_inc.setFleetSize(2)
env_inc.setFleetSize(10)
env_inc.setFleetSize(1)
env_inc.setFleetSize(11)
pp = pprint.PrettyPrinter(indent=4)
## pp.pprint(env.fleet.vehicles)
print json.dumps(env_all.getSegment(0, 86400, False), default=sim_util.default_json, separators=(',', ':'), indent=4)
print len(testdata), "trips generated"
