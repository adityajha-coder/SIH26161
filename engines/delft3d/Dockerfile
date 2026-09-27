FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gfortran \
    cmake \
    libnetcdf-dev \
    libnetcdff-dev \
    libopenmpi-dev \
    openmpi-bin \
    libgdal-dev \
    python3 \
    python3-pip \
    python3-gdal \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/delft3d

# Environment setup for D-Flow FM
ENV DFLOW_HOME=/opt/delft3d
ENV PATH="${DFLOW_HOME}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${DFLOW_HOME}/lib:${LD_LIBRARY_PATH}"

# Install Python geospatial post-processing tools
RUN pip3 install --no-cache-dir \
    numpy \
    scipy \
    netCDF4 \
    xarray \
    rasterio

# Copy solver wrapper and benchmark harness
COPY runner.py /opt/delft3d/bin/dflowfm_runner.py
RUN chmod +x /opt/delft3d/bin/dflowfm_runner.py

WORKDIR /workspace

ENTRYPOINT ["python3", "/opt/delft3d/bin/dflowfm_runner.py"]
