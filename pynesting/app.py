import os, tempfile, sys, json, traceback, re, math
import svgelements as se
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.affinity import rotate, translate
from shapely.ops import unary_union
from shapely.strtree import STRtree
import xml.etree.ElementTree as ET

# Version: 0.1 (BETA) - English Refactor with Gravity Strategies

def get_temp_path(name):
    return os.path.join(tempfile.gettempdir(), "ai_nesting", name)

def log(msg):
    with open(get_temp_path("log.txt"), "a") as f:
        f.write(f"{msg}\n")

def svg_to_shapes(svg_path):
    """Parses SVG into Shapely polygons using ET for IDs and svgelements for paths."""
    if not os.path.exists(svg_path): 
        log(f"Error: SVG file not found at {svg_path}")
        return {}
    
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()
        for el in root.iter():
            if '}' in el.tag: el.tag = el.tag.split('}', 1)[1]
        
        item_geoms = {}
        log("Searching for item groups/elements in SVG...")
        for element in root.iter():
            eid = element.get('id') or element.get('{http://www.w3.org/2000/svg}id') or element.get('data-name')
            if eid:
                match = re.search(r'item(\d+)', str(eid).lower())
                if match:
                    target_id = "item" + match.group(1)
                    if target_id not in item_geoms: item_geoms[target_id] = []
                    
                    elements_to_process = [element] if element.tag != 'g' else element.iter()
                    for sub_el in elements_to_process:
                        tag = sub_el.tag
                        poly = None
                        try:
                            if tag == 'path':
                                d = sub_el.get('d')
                                if d:
                                    path = se.Path(d)
                                    sub_polys = []
                                    for sub in path.as_subpaths():
                                        if len(sub) < 2: continue
                                        length = sub.length()
                                        if length < 0.1: continue
                                        sample_count = min(100, max(20, int(length / 2)))
                                        pts = [sub.point(i/sample_count) for i in range(sample_count+1)]
                                        if len(pts) < 3: continue
                                        p = Polygon([(pt.x, pt.y) for pt in pts])
                                        if not p.is_valid: p = p.buffer(0)
                                        if p.is_valid and not p.is_empty: sub_polys.append(p)
                                    if sub_polys: poly = unary_union(sub_polys)
                            elif tag == 'rect':
                                x, y = float(sub_el.get('x', 0)), float(sub_el.get('y', 0))
                                w, h = float(sub_el.get('width', 0)), float(sub_el.get('height', 0))
                                poly = box(x, y, x+w, y+h)
                            elif tag in ['circle', 'ellipse']:
                                if tag == 'circle':
                                    el_se = se.Circle(cx=float(sub_el.get('cx',0)), cy=float(sub_el.get('cy',0)), r=float(sub_el.get('r',0)))
                                else:
                                    el_se = se.Ellipse(cx=float(sub_el.get('cx',0)), cy=float(sub_el.get('cy',0)), rx=float(sub_el.get('rx',0)), ry=float(sub_el.get('ry',0)))
                                length = el_se.length()
                                sample_count = min(80, max(20, int(length / 2)))
                                pts = [el_se.point(i/sample_count) for i in range(sample_count+1)]
                                poly = Polygon([(pt.x, pt.y) for pt in pts])
                            elif tag in ['polygon', 'polyline']:
                                pts_str = sub_el.get('points')
                                if pts_str:
                                    pts = [tuple(map(float, p.split(','))) for p in pts_str.strip().split()]
                                    if len(pts) >= 3: poly = Polygon(pts)
                            
                            if poly:
                                if not poly.is_valid: poly = poly.buffer(0)
                                item_geoms[target_id].append(poly)
                        except: continue

        final_shapes = {}
        for uid, polys in item_geoms.items():
            if not polys: continue
            merged = unary_union(polys)
            if not merged.is_valid: merged = merged.buffer(0)
            if isinstance(merged, Polygon):
                if merged.interiors: merged = Polygon(merged.exterior)
            elif isinstance(merged, MultiPolygon):
                merged = unary_union([Polygon(p.exterior) for p in merged.geoms])
            final_shapes[uid] = merged
        return final_shapes
    except Exception as e:
        log(f"Major error in svg_to_shapes: {e}")
        return {}

def run_nesting():
    # Clear log
    with open(get_temp_path("log.txt"), "w") as f: 
        f.write("--- NESTING LOG START ---\n")
    
    log("--- STARTING NESTING ENGINE v0.1 (Heuristic Search) ---")
    items_path = get_temp_path("items.txt")
    results_path = get_temp_path("results.txt")
    svg_path = get_temp_path("export.svg")

    try:
        if not os.path.exists(items_path): 
            log("Error: items.txt missing")
            return
            
        with open(items_path, "r") as f: lines = f.readlines()
        
        config = lines[0].strip().split(",")
        container_w, container_h = float(config[0]), float(config[1])
        spacing = float(config[2])
        is_hp = config[3] == "1"
        
        # Strategy: 0=Minimize Roll Length (Y-priority), 1=Minimize Roll Width (X-priority)
        try:
            strategy = int(config[4])
        except (IndexError, ValueError):
            strategy = 0 
            
        log(f"Config: W={container_w}, H={container_h}, Spacing={spacing}, HP={is_hp}, Strategy={strategy}")

        container_poly = box(0, 0, container_w, container_h)
        
        items = []
        for line in lines[1:]:
            parts = line.strip().split(",")
            if len(parts) == 3:
                items.append({'id': parts[0], 'w': float(parts[1]), 'h': float(parts[2])})

        geoms = svg_to_shapes(svg_path) if is_hp else {}
        
        # Pre-process geometries: Normalize AND PRE-BUFFER
        buf = spacing / 2.0
        processed_geoms = {}
        for uid, poly in geoms.items():
            b = poly.bounds
            poly = translate(poly, -b[0], -b[1])
            processed_geoms[uid] = poly.buffer(buf)

        # Sort by area
        items.sort(key=lambda x: x['h'] * x['w'], reverse=True)

        placed_results = []
        placed_geoms_list = []
        total_bounds = [0, 0, 0, 0] # [minx, miny, maxx, maxy]

        for item in items:
            uid = item['id']
            log(f"Placing {uid}...")
            found = False
            
            if is_hp and uid in processed_geoms:
                base_geom = processed_geoms[uid]
                for angle in [0, 90, 180, 270]:
                    if found: break
                    rotated = rotate(base_geom, angle, origin=(0,0)) if angle != 0 else base_geom
                    rb = rotated.bounds
                    test_shape = translate(rotated, -rb[0], -rb[1])
                    tw, th = rb[2]-rb[0], rb[3]-rb[1]
                    
                    # Search range - Always evaluate full sheet
                    search_maxx = container_w - tw
                    search_maxy = container_h - th
                    
                    step = max(3, int(spacing / 2))
                    
                    # Generate candidates
                    candidates = []
                    try:
                        for y in range(0, int(search_maxy) + step, step):
                            for x in range(0, int(search_maxx) + step, step):
                                # Score based on strategy
                                if strategy == 0: # Minimize Roll Length (Y-priority)
                                    score = (y * 10) + x
                                else: # Minimize Roll Width (X-priority)
                                    score = (x * 10) + y
                                
                                candidates.append((x, y, score))
                    except Exception as e:
                        log(f"Error generating candidates for {uid}: {e}")
                        continue
                    
                    # Sort candidates by score
                    candidates.sort(key=lambda c: c[2])
                    
                    tree = STRtree(placed_geoms_list) if placed_geoms_list else None
                    
                    for cx, cy, score_val in candidates:
                        candidate = translate(test_shape, cx, cy)
                        
                        # Within container?
                        if not container_poly.contains(candidate): continue
                        
                        # Collision check
                        if tree:
                            if tree.query(candidate, predicate="intersects").size == 0:
                                found = True
                        else:
                            found = True
                            
                        if found:
                            # IMPORTANT: Adjust for buffer offset and invert rotation for Illustrator
                            placed_results.append(f"{uid},{cx + buf},{cy + buf},{-angle}")
                            placed_geoms_list.append(candidate)
                            cb = candidate.bounds
                            total_bounds[2] = max(total_bounds[2], cb[2])
                            total_bounds[3] = max(total_bounds[3], cb[3])
                            log(f" - Placed {uid} at {cx},{cy} (Angle: {angle}, Score: {score_val:.1f})")
                            break
            
            if not found:
                log(f" - Fallback for {uid}")
                item_box = box(0, 0, item['w'], item['h']).buffer(buf)
                rb = item_box.bounds
                test_box = translate(item_box, -rb[0], -rb[1])
                tw, th = rb[2]-rb[0], rb[3]-rb[1]
                
                # Heuristic fallback coordinates - Search full area
                fb_candidates = []
                try:
                    for y in range(0, int(container_h - th), 10):
                        for x in range(0, int(container_w - tw), 10):
                            if strategy == 0: score = (y * 10) + x
                            else: score = (x * 10) + y
                            fb_candidates.append((x, y, score))
                except Exception as e:
                    log(f"Error generating fallback candidates for {uid}: {e}")
                
                fb_candidates.sort(key=lambda c: c[2])
                
                tree = STRtree(placed_geoms_list) if placed_geoms_list else None
                for fx, fy, _ in fb_candidates:
                    candidate = translate(test_box, fx, fy)
                    if not container_poly.contains(candidate): continue
                    if not tree or tree.query(candidate, predicate="intersects").size == 0:
                        # IMPORTANT: Adjust for buffer offset
                        placed_results.append(f"{uid},{fx + buf},{fy + fy + buf if False else fy + buf},0") # Tiny safety fix in logic
                        placed_geoms_list.append(candidate)
                        cb = candidate.bounds
                        total_bounds[2] = max(total_bounds[2], cb[2])
                        total_bounds[3] = max(total_bounds[3], cb[3])
                        found = True
                        break
                
                if not found: log(f"CRITICAL: Could not place {uid} even with fallback.")

        with open(results_path, "w") as f: 
            f.write("\n".join(placed_results))
        log("Nesting completed successfully.")
        
    except Exception as e:
        log(f"CRASH: {e}\n{traceback.format_exc()}")

if __name__ == "__main__": 
    run_nesting()
