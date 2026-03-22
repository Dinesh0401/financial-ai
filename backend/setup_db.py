import asyncio
import asyncpg

async def run():
    url = "postgresql://postgres:4pU1DoOml68ijvDV@db.qtndxfbonrzyfzdgnhan.supabase.co:5432/postgres"
    print("Connecting to Supabase...")
    try:
        conn = await asyncpg.connect(url)
        with open("database_schema.sql", "r") as f:
            sql = f.read()
        print("Executing schema setup...")
        await conn.execute(sql)
        await conn.close()
        print("Schema successfully created!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run())
