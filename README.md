# pev-simulation
[V1 Demo Video (2017)](https://youtu.be/1vcRLGNjl3E)

# PEV SimApp V4 Architecture

[Link to edit diagram on LucidChart](https://www.lucidchart.com/invitations/accept/e1dfca89-6a07-4b69-a5e7-98147b56fdfc)

[Link to PowerPoint visualization of key features](https://docs.google.com/presentation/d/1eAi3rYy4O6R9oW1tQVdBr2pEis53ephnnRyHMtVPIlM/edit?usp=sharing)

# Setup OSRM Backend Routing Server

#### Analytic Data Explanation
* Trial: Trial #
* PEVs: Fleet size
* Trips: Total # of trips
* Bike/Taxi/Random: # of each type of trip
* Trips/Day: Avg trips/hr * 24
* Wait Time: Avg time spent waiting for car to arrive
* Assignment Time: Avg time spent waiting for a car to be assigned
* Avg Empty Trips: Avg time navigating to pickup
* Avg Job Trips: Avg time driving passenger
* Utilization: % of driving time car spends delivering passengers

#### OS X Install Dependencies

Please install the [homebrew](http://mxcl.github.com/homebrew/) package system. It will provide all necessary dependencies:

`brew install boost wget git cmake libzip libstxxl libxml2 lua tbb ccache`

To be able to compile tools:

`brew install GDAL`

PLEASE ENSURE THAT XCODE IS INSTALLED AND UPDATED

#### OS X Build (ENABLE_MASON=ON)

    git clone https://github.com/Project-OSRM/osrm-backend.git
    cd osrm-backend
    mkdir build
    cd build
    cmake .. -DENABLE_MASON=1
    make

#### OS X Running OSRM
    cd osrm-backend
    mkdir map
    cd map
    wget -O map.xml https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039

    (or install from the link directly https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039 and move to osrm-backend/map and change filename to map.xml)

    cd ..
    ./build/osrm-extract map/map.xml -p profiles/bicycle.lua
    ./build/osrm-contract map/map.xml.osrm
    ./build/osrm-routed map/map.xml.osrm

#### Windows Running OSRM
Install [Visual Studio 2019](https://visualstudio.microsoft.com/downloads/). 

Make sure you install "Desktop development with C++" and check the option for "MSVC v140 - VS 2015" as pictured [here](https://i.imgur.com/SB3nUBV.png).

Download the latest release build from [build.project-osrm.org](http://build.project-osrm.org/).

    cd osrm_Release
    mkdir map
    cd map
    wget -O map.xml "https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039"

    (or install from the link directly "https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039" and move to osrm-Release/map and change filename to map.xml)

    cd ..
    osrm-extract map/map.xml -p bicycle.lua
    osrm-contract map/map.xml.osrm
    osrm-routed -i [your IP here] -p 9002 map/map.xml.osrm

After setting up the OSRM backend the first time, you only need to run the command `osrm-routed -i [your IP here] -p 9002 map/map.xml.osrm` to launch the server.

# Setup frontend & backend server
Check these Python packages installed: requests, simplejson

#### RUN LOCAL SERVER
    python sim_serv.py
    navigate to http://localhost:8235

#### RUN SERVER ON Media Lab Virtual Machine (Ubuntu 16.04)
    #connect to the vm via terminal
    ssh ptinn@osrm.media.mit.edu
    password: ChangeThis!
    
    #use the shell file to launch both fron-end and back-end server
    sudo ./run_pev_sim.sh
    
    #exit the terminal view while keeping the server running
    logout
    
    #launch the app via browser 
    http://pev-simulation.media.mit.edu:8000
    
    #to kill the front-end app process, if you need to manually reset the app
    sudo kill -9 `sudo lsof -t -i:8000`
    
    #to view logs
    cat ~/osrm_out.log
    cat ~/sim_serv.log
    
    
