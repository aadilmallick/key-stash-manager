
import React, { useEffect } from 'react';
import { useSecretsStore } from '../store/secretsStore';
import FolderSidebar from '../components/FolderSidebar';
import SecretsList from '../components/SecretsList';

const Index = () => {
  const { loadData } = useSecretsStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="h-screen flex bg-gray-50">
      <FolderSidebar />
      <SecretsList />
    </div>
  );
};

export default Index;
