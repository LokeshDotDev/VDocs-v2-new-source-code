# 🚀 Vdocs - One Command Start

## All Set! Just Run This:

```bash
docker compose -f docker-compose.production.yml up
```

That's it! No configuration needed. No environment files. No setup. Just one command.

## ✅ Everything Will Be Ready

Once containers start, access here:

- **Web App**: http://localhost:3000
- **API**: http://localhost:4000
- **Storage Console**: http://localhost:9001 (admin / minioadmin)

## 📊 What Starts

9 services automatically:

✅ Frontend (port 3000)  
✅ API Server (port 4000)  
✅ File Upload (port 4001)  
✅ Database (port 5432)  
✅ Storage (port 9000)  
✅ PII Detector (port 5018)  
✅ Text Paraphraser (port 8000)  
✅ Grammar Checker (port 8001)  
✅ PDF Converter (port 5000)  

## 🛑 To Stop

```bash
docker compose -f docker-compose.production.yml down
```

## 📖 Need Help?

See `DOCKER_README.md` for detailed guides.

---

**That's all you need to know!** 🎉
