import os, tempfile, sys

def get_temp_path(name):
    return os.path.join(tempfile.gettempdir(), "ai_nesting", name)

if __name__ == "__main__":
    try:
        items_path = get_temp_path("items.txt")
        results_path = get_temp_path("results.txt")
        
        if not os.path.exists(items_path): sys.exit(1)

        with open(items_path, "r") as f:
            lines = f.readlines()

        # Första raden: width, height, spacing
        config = lines[0].strip().split(",")
        w, h, spacing = float(config[0]), float(config[1]), float(config[2])

        # Resten: id, width, height
        items = []
        for line in lines[1:]:
            parts = line.strip().split(",")
            if len(parts) == 3:
                items.append({'id': parts[0], 'w': float(parts[1]), 'h': float(parts[2])})

        # --- Enkel Shelf Packing ---
        items.sort(key=lambda x: x['h'], reverse=True)
        
        results = []
        cur_x, cur_y = 0, 0
        shelf_h = 0
        
        for item in items:
            if cur_x + item['w'] > w:
                cur_x = 0
                cur_y += shelf_h + spacing
                shelf_h = 0
            
            # Kolla om den får plats i höjd på ritytan
            if cur_y + item['h'] > h:
                continue 

            results.append(f"{item['id']},{cur_x},{cur_y}")
            
            cur_x += item['w'] + spacing
            shelf_h = max(shelf_h, item['h'])

        # Skriv resultat till textfil
        with open(results_path, "w") as f:
            f.write("\n".join(results))

    except Exception as e:
        with open(get_temp_path("error.txt"), "w") as f:
            f.write(str(e))
