cd /Users/aadilmallick/Documents/aadildev/projects/key-stash-manager && npm run build --prefix frontend
pm2 start -n key-stash-manager server.js
pm2 ls
echo 'running on http://localhost:5001'
