import svgelements as se
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union
import os

def svg_to_shapely(svg_path):
    """Konverterar SVG-stigar till Shapely-polygoner för geometriberäkning."""
    if not os.path.exists(svg_path):
        print(f"Fel: Hittade inte filen {svg_path}")
        return []

    svg = se.SVG.parse(svg_path)
    polygons = []

    for element in svg.elements():
        if isinstance(element, (se.Path, se.Rect, se.Circle, se.Ellipse, se.Polygon)):
            # Skapa punkter längs stigen (approximation av kurvor)
            points = []
            # Vi samplar stigen för att skapa en polygon
            try:
                # Steglängd för sampling av kurvor (lägre = mer exakt men långsammare)
                for i in range(101):
                    p = element.point(i / 100.0)
                    points.append((p.x, p.y))
                
                if len(points) >= 3:
                    poly = Polygon(points)
                    if poly.is_valid:
                        polygons.append(poly)
            except Exception as e:
                print(f"Kunde inte konvertera element: {e}")

    return polygons

def calculate_stats(polygons):
    """Beräknar och skriver ut statistik om de inlästa formerna."""
    if not polygons:
        print("Inga giltiga former hittades.")
        return

    total_area = sum(p.area for p in polygons)
    
    # Beräkna sammanlagd bounding box
    combined = unary_union(polygons)
    bounds = combined.bounds # (minx, miny, maxx, maxy)
    bbox_area = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])
    
    efficiency = (total_area / bbox_area) * 100 if bbox_area > 0 else 0

    print(f"Antal objekt: {len(polygons)}")
    print(f"Total form-yta: {total_area:.2f} px²")
    print(f"Bounding box yta: {bbox_area:.2f} px²")
    print(f"Packningsgrad (nuvarande): {efficiency:.1f}%")

if __name__ == "__main__":
    # För testning: Använd en enkel SVG om den finns
    sample_svg = "sample_rect.svg"
    if os.path.exists(sample_svg):
        print(f"Läser in {sample_svg}...")
        shapes = svg_to_shapely(sample_svg)
        calculate_stats(shapes)
    else:
        print("Skapa en SVG-fil för att testa scriptet.")
