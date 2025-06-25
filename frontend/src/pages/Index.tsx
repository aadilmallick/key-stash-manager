import React, { useEffect } from "react";
import { useSecretsStore } from "../store/secretsStore";
import FolderSidebar from "../components/FolderSidebar";
import SecretsList from "../components/SecretsList";

const Index = () => {
  const { loadData } = useSecretsStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  // useEffect(() => {
  //   // create interval to push sync with server every 10 seconds
  //   const minutes = 10;
  //   const interval = setInterval(async () => {
  // const response = await fetch("/api/sync", {
  //   method: "POST",
  //   body: JSON.stringify(localStorage.getItem("api-key-manager-secrets")),
  // });
  // if (response.ok) {
  //   console.log("Synced with server");
  // } else {
  //   console.error("Failed to sync with server");
  // }
  //   }, 1000 * 60 * minutes);

  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div className="h-screen flex bg-gray-50">
      <FolderSidebar />
      <SecretsList />
    </div>
  );
};

export default Index;
