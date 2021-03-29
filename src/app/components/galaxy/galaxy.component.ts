import {Component, OnDestroy, OnInit} from '@angular/core';
import {Planet} from '../../models/planet.model';
import {Vehicle} from '../../models/vehicle.model';
import {DataService} from '../../services/data.service';
import {NavigationExtras, Router} from '@angular/router';
import {ToastrService} from 'ngx-toastrService';
import {Observable, Subscription} from 'rxjs';
import {NavigateService} from '../../services/navigate.service';
import {mergeMap} from 'rxjs/operators';

@Component({
  selector: 'ff-galaxy',
  templateUrl: './galaxy.component.html',
  styleUrls: ['./galaxy.component.scss']
})
export class GalaxyComponent implements OnInit, OnDestroy {

  planets: Array<Planet> = [];
  vehicles: Array<Vehicle> = [];

  selectedPlanetsCount: number = 0;
  assignedVehicleCount: number = 0;

  lastDrag: boolean = false;

  timeTaken: number = 0;

  resetSub: Subscription;

  constructor(private dataService: DataService, private toastrService: ToastrService,
              private router: Router, private navigateService: NavigateService) {
  }

  ngOnInit() {

    this.selectedPlanetsCount = 0;

    this.dataService.getPlanets().subscribe(
      (planets: Planet[]) => {
        this.planets = planets;
      }
    );

    this.dataService.getVehicles().subscribe(
      (vehicles: Vehicle[]) => {
        this.vehicles = [];

        for (const vehicle of vehicles) {
          for (let i = 1; i <= vehicle.total_no; i++) {
            vehicle.isAvailable = true;
            vehicle.id = vehicle.name + '_' + i;
            this.vehicles.push(JSON.parse(JSON.stringify(vehicle)));
          }
        }
      });

    this.resetSub = this.navigateService.resetSubject.subscribe(_ => {
      this.reset();
    });

  }

  selectThisPlanet(planet: Planet) {

    if (!planet.isSelected) {
      if (this.selectedPlanetsCount === 4) {

        this.toastrService.error('Please unselect one and select a new planet.');
        return false;
      }
    }

    planet.isSelected = !planet.isSelected;
    if (!planet.isSelected) {

      if (planet.assignedVehicle) {

        this.resetVehicles(planet.assignedVehicle); // Reset the vehicles
        planet.assignedVehicle = null;

        this.recalculateAssignedVehicles();
        this.recalculateTime();

      }
    }

    this.selectedPlanetsCount = 0;
    this.planets.forEach(planet => {
      this.selectedPlanetsCount += planet.isSelected ? 1 : 0;
    });
  }


  allowDrop(ev) {
    ev.preventDefault();
  }

  dragVehicle(ev, vehicle) {
    const img = new Image();
    img.src = 'assets/icons/' + vehicle.name.toLowerCase() + '_new.PNG';
    img.width = 50;
    img.height = 50;

    ev.dataTransfer.setData('text/plain', JSON.stringify(vehicle));
    ev.dataTransfer.setDragImage(img, 0, 0);
  }


  connectVehicleToPlanet(ev, planet) {

    ev.preventDefault();

    // We have the vehicle and the planet that it is being dropped on. So first we check if the vehicle can cover the distance or not
    // console.log(planet);

    const vehicleData = JSON.parse(ev.dataTransfer.getData('text/plain'));
    if (vehicleData.max_distance < planet.distance) {

      this.toastrService.error('The vehicle chosen cannot travel to this planet.');
      this.lastDrag = false;
      return false;

    } else if (!planet.isSelected) {

      this.toastrService.error('This planet has not been chosen for exploration.');
      this.lastDrag = false;
      return false;

    } else {

      if (planet.assignedVehicle) {
        this.resetVehicles(planet.assignedVehicle);
      }

      planet.assignedVehicle = vehicleData;
      this.lastDrag = true;

      this.recalculateAssignedVehicles();
      this.recalculateTime();

    }
  }

  markVehicleForSelection(ev, vehicle) {

    if (ev.dataTransfer.dropEffect === 'none') {
      return false;
    } else {

      if (this.lastDrag) // Since the drag operation might be rejected because of business reasons
      {
        vehicle.isAvailable = false;
      }
    }
  }

  resetVehicles(assignedVehicle) {

    // Need to reset vehicles as well.
    this.vehicles = this.vehicles.map(vehicle => {
      if (vehicle.id === assignedVehicle.id) {
        vehicle.isAvailable = true;
      }
      return vehicle;
    });
  }

  reset() {
    this.vehicles = this.vehicles.map(vehicle => {
      vehicle.isAvailable = true;
      return vehicle;
    });
    this.planets = this.planets.map(planet => {
      planet.isSelected = false;
      planet.assignedVehicle = null;
      return planet;
    });
    this.selectedPlanetsCount = this.assignedVehicleCount = 0;
    this.timeTaken = 0;
  }


  recalculateAssignedVehicles() {

    this.assignedVehicleCount = 0;
    this.planets.forEach(planet => {
      this.assignedVehicleCount += planet.assignedVehicle ? 1 : 0;
    });
  }


  recalculateTime() {

    this.timeTaken = 0;

    const travelTimes = [];
    this.planets.forEach(planet => {
      if (planet.isSelected && planet.assignedVehicle) {
        travelTimes.push(Math.round(planet.distance / planet.assignedVehicle.speed));
      }
    });

    this.timeTaken = Math.max(...travelTimes);
  }


  findFalcone() {

    let response = {};

    if (this.selectedPlanetsCount < 4 || this.assignedVehicleCount < 4) {
      this.toastrService.error('Please choose 4 planets & assign appropriate vehicles to them to proceed.');
      return false;
    } else if (this.selectedPlanetsCount === 4 && this.assignedVehicleCount === 4) {
      let findFalcones: Observable<any>;

      findFalcones = this.dataService.getToken().pipe(
        mergeMap((token: any): any => {
          const body = {};
          body['token'] = token;
          body['planet_names'] = [];
          body['vehicle_names'] = [];

          this.planets.forEach(planet => {
            if (planet.isSelected) {
              body['planet_names'].push(planet.name);
              if (planet.assignedVehicle) {
                body['vehicle_names'].push(planet.assignedVehicle.name);
              }
            }
          });
          this.dataService.findFalcone(body);
        })
      );
      findFalcones.subscribe(res => {

      }, error => {

        this.toastrService.error('No token available. Mock Implementation kicks in.');

        const randomPlanetIndex = Math.floor(Math.random() * (6 - 0)) + 0;
        const winnerPlanet = this.planets[randomPlanetIndex];

        let planetFound = false;

        this.planets.forEach(planet => {
          if (planet.isSelected) {
            if (planet.name === winnerPlanet.name) {
              planetFound = true;
            }
          }
        });

        if (planetFound) {

          response = {
            'planet_name': winnerPlanet.name,
            'time_taken': this.timeTaken,
            'status': 'success'
          };
        } else {

          response = {
            'status': 'failure'
          };
        }

        const navigationExtras: NavigationExtras = {
          queryParams: {
            response: JSON.stringify(response)
          }
        };
        this.router.navigate(['result'], navigationExtras);
      });
    }
  }

  ngOnDestroy() {
    this.resetSub.unsubscribe();
  }
}
