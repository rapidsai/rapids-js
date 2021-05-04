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

#include <node_cudf/column.hpp>
#include <node_cudf/utilities/napi_to_cpp.hpp>

#include <node_rmm/device_buffer.hpp>
#include <node_rmm/utilities/napi_to_cpp.hpp>

#include <nv_node/utilities/wrap.hpp>

#include <cudf/column/column.hpp>
#include <cudf/column/column_view.hpp>
#include <cudf/null_mask.hpp>
#include <cudf/stream_compaction.hpp>
#include <cudf/table/table_view.hpp>
#include <cudf/types.hpp>

#include <rmm/device_buffer.hpp>

#include <napi.h>
#include <memory>
#include <utility>

namespace nv {

ObjectUnwrap<Column> Column::apply_boolean_mask(Column const& boolean_mask,
                                                rmm::mr::device_memory_resource* mr) const {
  try {
    auto result = cudf::apply_boolean_mask(cudf::table_view{{*this}}, boolean_mask, mr);
    std::vector<std::unique_ptr<cudf::column>> contents = result->release();
    return Column::New(std::move(contents[0]));
  } catch (cudf::logic_error const& e) { NAPI_THROW(Napi::Error::New(Env(), e.what())); }
}

ObjectUnwrap<Column> Column::drop_nulls(rmm::mr::device_memory_resource* mr) const {
  std::vector<cudf::size_type> keys{0};

  try {
    auto result = cudf::drop_nulls(cudf::table_view{{*this}}, keys, mr);
    std::vector<std::unique_ptr<cudf::column>> contents = result->release();
    return Column::New(std::move(contents[0]));
  } catch (cudf::logic_error const& e) { NAPI_THROW(Napi::Error::New(Env(), e.what())); }
}

Napi::Value Column::drop_nulls(Napi::CallbackInfo const& info) {
  return drop_nulls(NapiToCPP(info[0]).operator rmm::mr::device_memory_resource*());
}

ObjectUnwrap<Column> Column::drop_nans(rmm::mr::device_memory_resource* mr) const {
  std::vector<cudf::size_type> keys{0};

  try {
    auto result = cudf::drop_nans(cudf::table_view{{*this}}, keys, mr);
    std::vector<std::unique_ptr<cudf::column>> contents = result->release();
    return Column::New(std::move(contents[0]));
  } catch (cudf::logic_error const& e) { NAPI_THROW(Napi::Error::New(Env(), e.what())); }
}

Napi::Value Column::drop_nans(Napi::CallbackInfo const& info) {
  return drop_nans(NapiToCPP(info[0]).operator rmm::mr::device_memory_resource*());
}

ObjectUnwrap<Column> Column::drop_duplicates(bool is_nulls_equal,
                                             rmm::mr::device_memory_resource* mr) const {
  cudf::null_equality nulls_equal =
    is_nulls_equal ? cudf::null_equality::EQUAL : cudf::null_equality::UNEQUAL;

  try {
    return Column::New(std::move(
      cudf::drop_duplicates(
        cudf::table_view{{*this}}, {0}, cudf::duplicate_keep_option::KEEP_FIRST, nulls_equal, mr)
        ->release()[0]));
  } catch (cudf::logic_error const& e) { NAPI_THROW(Napi::Error::New(Env(), e.what())); }
}

Napi::Value Column::drop_duplicates(Napi::CallbackInfo const& info) {
  CallbackArgs args{info};
  return drop_duplicates(args[0], args[1]);
}

}  // namespace nv
