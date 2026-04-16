import os, tempfile, sys, json, traceback, re
import svgelements as se
from shapely.geometry import Polygon, MultiPolygon
from shapely.affinity import rotate, translate
from shapely.ops import unary_union
import xml.etree.ElementTree as ET

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
        # Load SVG with ElementTree to find IDs reliably
        tree = ET.parse(svg_path)
        root = tree.getroot()
        
        # Remove namespaces for easier searching
        for el in root.iter():
            if '}' in el.tag:
                el.tag = el.tag.split('}', 1)[1]
        
        item_geoms = {}
        
        # Search for any element or group that has an ID containing 'item'
        log("Searching for item groups/elements...")
        for element in root.iter():
            eid = element.get('id') or element.get('{http://www.w3.org/2000/svg}id')
            if not eid:
                # Some SVG exports use data-name
                eid = element.get('data-name')
                
            if eid:
                match = re.search(r'item(\d+)', str(eid).lower())
                if match:
                    target_id = "item" + match.group(1)
                    log(f"Found ID match: {eid} -> {target_id}")
                    
                    if target_id not in item_geoms:
                        item_geoms[target_id] = []
                    
                    # If this is a group, find all child paths/shapes
                    # If it's a single element, process it
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
                                        sample_count = min(150, max(30, int(length / 2)))
                                        pts = [sub.point(i/sample_count) for i in range(sample_count+1)]
                                        if len(pts) < 3: continue
                                        p = Polygon([(pt.x, pt.y) for pt in pts])
                                        if not p.is_valid: p = p.buffer(0)
                                        if p.is_valid and not p.is_empty: sub_polys.append(p)
                                    if sub_polys:
                                        poly = unary_union(sub_polys)
                            
                            elif tag == 'rect':
                                x = float(sub_el.get('x', 0))
                                y = float(sub_el.get('y', 0))
                                w = float(sub_el.get('width', 0))
                                h = float(sub_el.get('height', 0))
                                poly = Polygon([(x,y), (x+w, y), (x+w, y+h), (x, y+h)])
                            
                            elif tag in ['circle', 'ellipse']:
                                # Convert to path and sample
                                if tag == 'circle':
                                    el_se = se.Circle(cx=float(sub_el.get('cx',0)), cy=float(sub_el.get('cy',0)), r=float(sub_el.get('r',0)))
                                else:
                                    el_se = se.Ellipse(cx=float(sub_el.get('cx',0)), cy=float(sub_el.get('cy',0)), rx=float(sub_el.get('rx',0)), ry=float(sub_el.get('ry',0)))
                                
                                length = el_se.length()
                                sample_count = min(100, max(30, int(length / 2)))
                                pts = [el_se.point(i/sample_count) for i in range(sample_count+1)]
                                poly = Polygon([(pt.x, pt.y) for pt in pts])
                                
                            elif tag in ['polygon', 'polyline']:
                                pts_str = sub_el.get('points')
                                if pts_str:
                                    pts = [tuple(map(float, p.split(','))) for p in pts_str.strip().split()]
                                    if len(pts) >= 3:
                                        poly = Polygon(pts)
                        
                            if poly:
                                if not poly.is_valid: poly = poly.buffer(0)
                                item_geoms[target_id].append(poly)
                        except Exception as e:
                            log(f"Error processing {tag}: {e}")

        # Finalize geometries
        final_shapes = {}
        for uid, polys in item_geoms.items():
            if not polys: continue
            merged = unary_union(polys)
            if not merged.is_valid: merged = merged.buffer(0)
            
            # User requested: Fill holes (solid shapes)
            if isinstance(merged, Polygon):
                if merged.interiors:
                    merged = Polygon(merged.exterior)
            elif isinstance(merged, MultiPolygon):
                merged = unary_union([Polygon(p.exterior) for p in merged.geoms])
            
            final_shapes[uid] = merged
            log(f" - Finalized {uid} (area: {merged.area:.1f})")

        log(f"Extracted {len(final_shapes)} items.")
        return final_shapes

    except Exception as e:
        log(f"Major error in svg_to_shapes: {e}\n{traceback.format_exc()}")
        return {}

def run_nesting():
    with open(get_temp_path("log.txt"), "w") as f:
        f.write("--- NESTING LOG START ---\n")

    log("--- STARTING NESTING ENGINE V3.5 ---")
    items_path = get_temp_path("items.txt")
    results_path = get_temp_path("results.txt")
    svg_path = get_temp_path("export.svg")

    try:
        if not os.path.exists(items_path):
            log("Error: items.txt missing")
            return

        with open(items_path, "r") as f:
            lines = f.readlines()

        config = lines[0].strip().split(",")
        container_w = float(config[0])
        container_h = float(config[1])
        spacing = float(config[2])
        is_hp = config[3] == "1"

        log(f"Config: W={container_w}, H={container_h}, Spacing={spacing}, HP={is_hp}")

        items = []
        for line in lines[1:]:
            parts = line.strip().split(",")
            if len(parts) == 3:
                items.append({'id': parts[0], 'w': float(parts[1]), 'h': float(parts[2])})

        geoms = svg_to_shapes(svg_path) if is_hp else {}
        
        if is_hp and not geoms:
            log("WARNING: NO GEOMETRIES FOUND. Falling back to boxes.")

        # Normalize geometries
        processed_geoms = {}
        for uid, poly in geoms.items():
            b = poly.bounds
            poly = translate(poly, -b[0], -b[1])
            processed_geoms[uid] = poly

        # Sort by area
        items.sort(key=lambda x: x['h'] * x['w'], reverse=True)

        placed_results = []
        placed_union = None
        
        for item in items:
            uid = item['id']
            log(f"Placing {uid}...")
            found = False
            
            if is_hp and uid in processed_geoms:
                geom = processed_geoms[uid]
                for angle in [0, 90, 180, 270]:
                    if found: break
                    rotated = rotate(geom, angle, origin=(0,0)) if angle != 0 else geom
                    rb = rotated.bounds
                    test_shape = translate(rotated, -rb[0], -rb[1])
                    tw, th = rb[2]-rb[0], rb[3]-rb[1]
                    
                    # Search
                    step = max(2, int(spacing / 3)) if spacing > 0 else 4
                    for y in range(0, int(container_h - th), step):
                        if found: break
                        for x in range(0, int(container_w - tw), step):
                            candidate = translate(test_shape, x, y)
                            if placed_union is None or not candidate.intersects(placed_union):
                                placed_results.append(f"{uid},{x},{y}")
                                # Buffer for collision avoidance
                                # Adding a small epsilon to intersection to avoid precision issues
                                occ = candidate.buffer(spacing)
                                placed_union = unary_union([placed_union, occ]) if placed_union else occ
                                found = True
                                log(f" - Placed {uid} at {x},{y} (Angle: {angle})")
                                break
            
            if not found:
                log(f" - Box fallback for {uid}")
                if 'cur_x' not in locals():
                    cur_x, cur_y, shelf_h = 0, 0, 0
                if cur_x + item['w'] > container_w:
                    cur_x = 0
                    cur_y += shelf_h + spacing
                    shelf_h = 0
                if cur_y + item['h'] <= container_h:
                    placed_results.append(f"{uid},{cur_x},{cur_y}")
                    from shapely.geometry import box
                    occ = box(cur_x, cur_y, cur_x + item['w'], cur_y + item['h']).buffer(spacing)
                    placed_union = unary_union([placed_union, occ]) if placed_union else occ
                    cur_x += item['w'] + spacing
                    shelf_h = max(shelf_h, item['h'])

        with open(results_path, "w") as f:
            f.write("\n".join(placed_results))
        log("Done.")

    except Exception as e:
        log(f"CRASH: {e}\n{traceback.format_exc()}")

if __name__ == "__main__":
    run_nesting()
