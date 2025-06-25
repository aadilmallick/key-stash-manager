
import React, { useState, useEffect } from 'react';
import { Secret } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface SecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret?: Secret;
  onSave: (secretData: Omit<Secret, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const SecretModal = ({ isOpen, onClose, secret, onSave }: SecretModalProps) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (secret) {
      setName(secret.name);
      setValue(secret.value);
      setTags(secret.tags.join(', '));
    } else {
      setName('');
      setValue('');
      setTags('');
    }
  }, [secret, isOpen]);

  const handleSave = () => {
    if (!name.trim() || !value.trim()) return;

    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSave({
      name: name.trim(),
      value: value.trim(),
      tags: tagsArray
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {secret ? 'Edit Secret' : 'Add New Secret'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Secret name"
            />
          </div>

          <div>
            <Label htmlFor="value">Value</Label>
            <Textarea
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Secret value"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <p className="text-sm text-gray-500 mt-1">
              Separate multiple tags with commas
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!name.trim() || !value.trim()}
            >
              {secret ? 'Update' : 'Add'} Secret
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SecretModal;
