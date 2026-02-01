import "react-router";

declare module "react-router" {
  interface Register {
    params: Params;
  }
}

type Params = {
  "/": {};
  "/subscription": {};
  "/auth/login": {};
  "/auth/register": {};
  "/auth/callback": {};
  "/auth/forgot-password": {};
  "/auth/reset-password": {};
  "/projects": {};
  "/projects/:projectId/:projectName": {
    "projectId": string;
    "projectName": string;
  };
  "/projects/:projectId/:projectName/:flowId": {
    "projectId": string;
    "projectName": string;
    "flowId": string;
  };
};