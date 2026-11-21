from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from config import DATABASE_URI
from models import Base

engine = create_engine(DATABASE_URI, connect_args={"check_same_thread": False})
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine))

def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE users ADD COLUMN operator_auth_token VARCHAR(64)",
            "ALTER TABLE operator_auth_tokens ADD COLUMN user_id INTEGER",
            "ALTER TABLE operator_auth_tokens ADD COLUMN user_email VARCHAR(120)",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
