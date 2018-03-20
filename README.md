# pev-simulation
PEV

# Setup OSRM Backend Routing Server

#### OS X install dependencies

Please install the [homebrew](http://mxcl.github.com/homebrew/) package system. It will provide all necessary dependencies:

`brew install boost git cmake libzip libstxxl libxml2 lua tbb ccache`

To be able to compile tools:

`brew install GDAL`

PLEASE ENSURE THAT XCODE IS INSTALLED AND UPDATED

#### OS X BUILD (ENABLE_MASON=ON)

    git clone https://github.com/Project-OSRM/osrm-backend.git
    cd osrm-backend
    mkdir build
    cd build
    cmake .. -DENABLE_MASON=1
    make

#### OS X RUNNING OSRM
    cd osrm-backend
    mkdir map
    cd map
    wget -0 map.xml https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039

    (or install from the link directly https://overpass-api.de/api/map?bbox=-71.1700,42.3175,-70.9829,42.4039 and move to osrm-backend/map and change filename to map.xml)

    osrm-extract map.xml -p ../profiles/bicycle.lua
    osrm-contract map.xml.osrm
    osrm-routed map.xlm.osrm

# Setup frontend server
#### RUN SERVER
    python sim_serv.py
    navigate to http://localhost:8235

