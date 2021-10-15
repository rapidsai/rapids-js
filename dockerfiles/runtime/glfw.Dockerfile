ARG FROM_IMAGE
ARG DEVEL_IMAGE

FROM ${DEVEL_IMAGE} as devel

WORKDIR /home/node

RUN cp                              \
    /opt/rapids/wrtc-0.4.7-dev.tgz  \
    /opt/rapids/rapidsai-core-*.tgz \
    /opt/rapids/nvidia-glfw-*.tgz   \
    /opt/rapids/nvidia-webgl-*.tgz  \
    . \
 && npm install --production --omit dev --omit peer --omit optional --legacy-peer-deps --force *.tgz

FROM ${FROM_IMAGE}

SHELL ["/bin/bash", "-c"]

ENV NVIDIA_DRIVER_CAPABILITIES all

USER root

RUN export DEBIAN_FRONTEND=noninteractive \
 && apt update \
 && apt install -y --no-install-recommends \
    # X11 dependencies
    libxrandr-dev libxinerama-dev libxcursor-dev \
    # Wayland dependencies
    libwayland-dev wayland-protocols libxkbcommon-dev \
    # GLEW dependencies
    libgl1-mesa-dev libegl1-mesa-dev libglu1-mesa-dev \
    # node-canvas dependencies
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
 # Clean up
 && apt autoremove -y && apt clean \
 && rm -rf \
    /tmp/* \
    /var/tmp/* \
    /var/lib/apt/lists/* \
    /var/cache/apt/archives/*

COPY --from=devel --chown=node:node /home/node/node_modules/ /home/node/node_modules/

USER node

WORKDIR /home/node

SHELL ["/bin/bash", "-l"]

CMD ["node"]
