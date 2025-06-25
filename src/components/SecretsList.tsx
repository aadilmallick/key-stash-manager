
import React, { useState } from 'react';
import { useSecretsStore } from '../store/secretsStore';
import { Secret } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Edit, Trash2, Plus, Search, Copy, Check } from 'lucide-react';
import SecretModal from './SecretModal';
import { useToast } from '@/components/ui/use-toast';

const SecretsList = () => {
  const {
    data,
    selectedFolderId,
    searchTerm,
    selectedTags,
    setSearchTerm,
    setSelectedTags,
    addSecret,
    updateSecret,
    deleteSecret,
    getFilteredSecrets,
    getAllTags
  } = useSecretsStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | undefined>();
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedSecrets, setCopiedSecrets] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const selectedFolder = data.folders.find(f => f.id === selectedFolderId);
  const filteredSecrets = getFilteredSecrets();
  const allTags = getAllTags();

  const toggleSecretVisibility = (secretId: string) => {
    setVisibleSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (value: string, secretId: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecrets(prev => new Set(prev).add(secretId));
      toast({
        title: "Copied to clipboard",
        description: "Secret value has been copied to your clipboard.",
      });
      setTimeout(() => {
        setCopiedSecrets(prev => {
          const newSet = new Set(prev);
          newSet.delete(secretId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSecret = (secretData: Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingSecret) {
      updateSecret(selectedFolderId, editingSecret.id, secretData);
    } else {
      addSecret(selectedFolderId, secretData);
    }
    setEditingSecret(undefined);
  };

  const handleDeleteSecret = (secretId: string) => {
    if (confirm('Are you sure you want to delete this secret?')) {
      deleteSecret(selectedFolderId, secretId);
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(
      selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag]
    );
  };

  const maskValue = (value: string) => {
    return '*'.repeat(Math.min(value.length, 20));
  };

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedFolder?.name || 'Secrets'}
          </h1>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Secret
          </Button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search secrets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Filter by tags:</p>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {filteredSecrets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedFolder?.secrets.length === 0 ? (
              <p>No secrets in this folder. Add your first secret!</p>
            ) : (
              <p>No secrets match your search criteria.</p>
            )}
          </div>
        ) : (
          filteredSecrets.map((secret) => (
            <div
              key={secret.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-gray-900">{secret.name}</h3>
                    {secret.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono flex-1">
                      {visibleSecrets.has(secret.id) ? secret.value : maskValue(secret.value)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSecretVisibility(secret.id)}
                    >
                      {visibleSecrets.has(secret.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(secret.value, secret.id)}
                    >
                      {copiedSecrets.has(secret.id) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500">
                    Created: {new Date(secret.createdAt).toLocaleDateString()} • 
                    Updated: {new Date(secret.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSecret(secret);
                      setIsModalOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSecret(secret.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <SecretModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSecret(undefined);
        }}
        secret={editingSecret}
        onSave={handleSaveSecret}
      />
    </div>
  );
};

export default SecretsList;
