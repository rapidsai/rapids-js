// Copyright (c) 2020, NVIDIA CORPORATION.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#pragma once

#include "cuda/utilities/error.hpp"

#include <napi.h>

#include <nv_node/utilities/args.hpp>

#include <cstddef>
#include <cstdint>

namespace nv {

class Device : public Napi::ObjectWrap<Device> {
 public:
  /**
   * @brief Initialize the Device JavaScript constructor and prototype.
   *
   * @param env The active JavaScript environment.
   * @param exports The exports object to decorate.
   * @return Napi::Object The decorated exports object.
   */
  static Napi::Object Init(Napi::Env env, Napi::Object exports);

  /**
   * @brief Construct a new Device instance from C++.
   *
   * @param id The zero-based CUDA device ordinal.
   * @param flags Flags for the device's primary context.
   */
  static Napi::Object New(int32_t id     = current_device_id(),
                          uint32_t flags = cudaDeviceScheduleAuto);

  /**
   * @brief Retrieve the id of the current CUDA device for this thread.
   *
   * @return int32_t The CUDA device id.
   */
  static int32_t current_device_id() {
    int32_t device;
    NODE_CUDA_TRY(cudaGetDevice(&device));
    return device;
  }

  /**
   * @brief Check whether an Napi value is an instance of `Device`.
   *
   * @param val The Napi::Value to test
   * @return true if the value is a `Device`
   * @return false if the value is not a `Device`
   */
  inline static bool is_instance(Napi::Value const& val) {
    return val.IsObject() and val.As<Napi::Object>().InstanceOf(constructor.Value());
  }

  /**
   * @brief Construct a new Device instance from JavaScript.
   *
   * @param args The JavaScript arguments list wrapped in a conversion helper.
   */
  Device(CallbackArgs const& args);

  /**
   * @brief Initialize the Device instance created by either C++ or JavaScript.
   *
   * @param id The zero-based CUDA device id.
   * @param flags Flags for the device's primary context.
   */
  void Initialize(int32_t id = current_device_id(), uint32_t flags = cudaDeviceScheduleAuto);

  /**
   * @brief Destroy all allocations and reset all state on the current
   * device in the current process. Resets the device with the specified
   * device flags.
   *
   * Explicitly destroys and cleans up all resources associated with the
   * current device in the current process. Any subsequent API call to
   * this device will reinitialize the device.
   *
   * Note that this function will reset the device immediately. It is the
   * caller's responsibility to ensure that the device is not being accessed
   * by any other host threads from the process when this function is called.
   *
   * @param flags Flags for the device's primary context.
   *
   * @return Device const&
   */
  Device const& reset(uint32_t flags = cudaDeviceScheduleAuto);

  /**
   * @brief Set this device to be used for GPU executions.
   *
   * Sets this device as the current device for the calling host thread.
   *
   * Any device memory subsequently allocated from this host thread
   * will be physically resident on this device. Any host memory allocated
   * from this host thread will have its lifetime associated with this
   * device. Any streams or events created from this host thread will
   * be associated with this device. Any kernels launched from this host
   * thread will be executed on this device.
   *
   * This call may be made from any host thread, to any device, and at
   * any time. This function will do no synchronization with the previous
   * or new device, and should be considered a very low overhead call.
   *
   * @return Device const&
   */
  Device const& activate();

  /**
   * @brief Wait for this compute device to finish.
   *
   * Blocks execution of further device calls until the device has completed
   * all preceding requested tasks.
   *
   * @throw an error if one of the preceding tasks has failed. If the
   * `cudaDeviceScheduleBlockingSync` flag was set for this device, the
   * host thread will block until the device has finished its work.
   *
   * @return Device const&
   */
  Device const& synchronize();

  /**
   * @brief Queries if a device may directly access a peer device's memory.
   *
   * If direct access of `peer` from this device is possible, then
   * access may be enabled on two specific contexts by calling
   * `enable_peer_access`.
   *
   * @param peer
   * @return bool
   */
  bool can_access_peer_device(Device const& peer);

  /**
   * @brief Enables direct access to memory allocations in a peer device.
   *
   * @param peer
   * @return Device const&
   */
  Device const& enable_peer_access(Device const& peer);

  /**
   * @brief Disables direct access to memory allocations in a peer device and unregisters any
   * registered allocations.
   *
   * @param peer
   * @return Device const&
   */
  Device const& disable_peer_access(Device const& peer);

  int32_t id() const { return id_; }
  cudaDeviceProp const& props() const { return props_; }
  std::string const& pci_bus_name() const { return pci_bus_name_; }

 private:
  static Napi::FunctionReference constructor;

  int32_t id_{};              ///< The CUDA device identifer
  cudaDeviceProp props_;      ///< The CUDA device properties
  std::string pci_bus_name_;  ///< The CUDA device PCI bus id string

  template <typename Function>
  inline void call_in_context(Function const& do_work) {
    auto cur_device_id = this->current_device_id();
    auto change_device = [&](int32_t id) {
      if (cur_device_id != this->id()) {  //
        NODE_CUDA_TRY(cudaSetDevice(id), this->Env());
      }
    };
    try {
      change_device(this->id());
      do_work();
    } catch (...) {
      change_device(cur_device_id);
      throw std::current_exception();
    }
    change_device(cur_device_id);
  }

  Napi::Value reset(Napi::CallbackInfo const& info);
  Napi::Value activate(Napi::CallbackInfo const& info);
  Napi::Value synchronize(Napi::CallbackInfo const& info);
  Napi::Value can_access_peer_device(Napi::CallbackInfo const& info);
  Napi::Value enable_peer_access(Napi::CallbackInfo const& info);
  Napi::Value disable_peer_access(Napi::CallbackInfo const& info);

  Napi::Value GetId(Napi::CallbackInfo const& info);
  Napi::Value GetName(Napi::CallbackInfo const& info);
  Napi::Value GetPCIBusId(Napi::CallbackInfo const& info);
  Napi::Value GetPCIBusName(Napi::CallbackInfo const& info);
};

}  // namespace nv
