// React Router generated types for route:
// ./domain/flow/pages/detail.tsx

import type * as T from "react-router/route-module"

import type { Info as Parent0 } from "../../../../+types/root.js"
import type { Info as Parent1 } from "../../../../shared/providers/+types/index.js"
import type { Info as Parent2 } from "../../../project/layouts/+types/index.js"

type Module = typeof import("../detail.js")

export type Info = {
  parents: [Parent0, Parent1, Parent2],
  id: "domain/flow/pages/detail"
  file: "./domain/flow/pages/detail.tsx"
  path: "projects/:projectId/:projectName/:flowId"
  params: {"projectId": string; "projectName": string; "flowId": string} & { [key: string]: string | undefined }
  module: Module
  loaderData: T.CreateLoaderData<Module>
  actionData: T.CreateActionData<Module>
}

export namespace Route {
  export type LinkDescriptors = T.LinkDescriptors
  export type LinksFunction = () => LinkDescriptors

  export type MetaArgs = T.CreateMetaArgs<Info>
  export type MetaDescriptors = T.MetaDescriptors
  export type MetaFunction = (args: MetaArgs) => MetaDescriptors

  export type HeadersArgs = T.HeadersArgs
  export type HeadersFunction = (args: HeadersArgs) => Headers | HeadersInit

  export type unstable_MiddlewareFunction = T.CreateServerMiddlewareFunction<Info>
  export type unstable_ClientMiddlewareFunction = T.CreateClientMiddlewareFunction<Info>
  export type LoaderArgs = T.CreateServerLoaderArgs<Info>
  export type ClientLoaderArgs = T.CreateClientLoaderArgs<Info>
  export type ActionArgs = T.CreateServerActionArgs<Info>
  export type ClientActionArgs = T.CreateClientActionArgs<Info>

  export type HydrateFallbackProps = T.CreateHydrateFallbackProps<Info>
  export type ComponentProps = T.CreateComponentProps<Info>
  export type ErrorBoundaryProps = T.CreateErrorBoundaryProps<Info>
}