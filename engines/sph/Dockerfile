# DualSPHysics Smoothed Particle Hydrodynamics (SPH) Solver Container
# Pinned Revision: DualSPHysics v5.2 / CUDA & OpenMP CPU-GPU SPH Kernel
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgomp1 \
    libnetcdf-dev \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/dualsphysics

ENV DUALSPHYSICS_HOME=/opt/dualsphysics
ENV PATH="${DUALSPHYSICS_HOME}/bin:${PATH}"

RUN pip3 install --no-cache-dir \
    numpy \
    scipy \
    rasterio

COPY runner.py /opt/dualsphysics/bin/sph_runner.py
RUN chmod +x /opt/dualsphysics/bin/sph_runner.py

WORKDIR /workspace

ENTRYPOINT ["python3", "/opt/dualsphysics/bin/sph_runner.py"]
