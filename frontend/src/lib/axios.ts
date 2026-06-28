import axios, { AxiosInstance } from "axios";

const baseURL = import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";

export const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});
