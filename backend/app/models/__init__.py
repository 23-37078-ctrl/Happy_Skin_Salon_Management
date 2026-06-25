import importlib
import pkgutil
import pathlib

package_dir = pathlib.Path(__file__).parent

for module_info in pkgutil.iter_modules([str(package_dir)]):
    if not module_info.name.startswith("_"):
        importlib.import_module(f"{__name__}.{module_info.name}")