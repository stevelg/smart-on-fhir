var smartClient;

(function(window){
  window.extractData = function() {
    var ret = $.Deferred();
    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        smartClient = smart;
        var patient = smart.patient;
        var pt = patient.read();

        var med = smart.patient.api.fetchAll({
          type: 'MedicationOrder', // Use 'MedicationOrder' for DSTU2
        });

        $.when(pt, med).fail(onError);

        $.when(pt, med).done(function(patient, med) {
          var gender = patient.gender;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          // console.log(med);
          // console.log(patient);
          window.patientID = patient.id;
          var p = defaultPatient();
          p.medicationOrders = med;
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;

          

          // Get list of prescribed medication
          med.forEach(function(medicationOrder) {
            // console.log(medicationOrder);
            p.prescribedMedication.push(medicationOrder.medicationCodeableConcept.coding[0].code);
          });

          var prescribedMedicationList = p.prescribedMedication;
          // Get list of drug pairs for currently prescribed medication
          var drugPairs = [];
          for (let i = 0; i < prescribedMedicationList.length; i++) {
            for (let j = i + 1; j < prescribedMedicationList.length; j++) {
              drugPairs.push([prescribedMedicationList[i], prescribedMedicationList[j]]);
            }
          }

          // Check for drug interactions
          checkInteractions(drugPairs).then(function(interactingDrug) {
            p.interactingDrugs = interactingDrug;

            if (p.interactingDrugs.length > 0) {
              // Show the badge if there are any drug interactions
              document.getElementById("interactionBadge").style.display = "block";
            }

            p.interactingDrugs.forEach(function(interactingDrug) {
              var li = document.createElement("li");
              li.textContent = interactingDrug;
              // console.log(interactingDrug);
              document.getElementById("interactionList").appendChild(li);
            });
          }).catch(function(error) {
            console.log(error);
          });

          ret.resolve(p);
          $.when(pt, med).fail(onError);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  async function checkInteractions(drugPairs) {
    let interactingDrug = [];
    for (let pair of drugPairs) {
      let response = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${pair[0]}+${pair[1]}`);
      if (response.ok) {
        let data = await response.json();
        if (data.fullInteractionTypeGroup) {
          interactingDrug.push(data.fullInteractionTypeGroup[0].fullInteractionType[0].interactionPair[0].description);
        }
      }
    }
    return interactingDrug;
  }
    
  function addDays(dateStr, days) {
    var date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date;
  }

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      medicationOrders: {value: []},
      prescribedMedication: [],
      interactingDrugs: []
    };
  }

  window.drawVisualization = function(p) {
    document.getElementById("interactionBadge").style.display = "none";

    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname); 
    $('#lname').html(p.lname);
    $('#fullname').html(p.fname + ' ' + p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);

    p.medicationOrders.forEach(function(medicationOrder) {
      var medicationStatus = medicationOrder.status;
      var medicationName = medicationOrder.medicationCodeableConcept.text;
      console.log(medicationOrder);
      if (!medicationOrder.dosageInstruction
        || !medicationOrder.dosageInstruction[0]
        || !medicationOrder.dosageInstruction[0].timing
        || !medicationOrder.dosageInstruction[0].doseQuantity
        || !medicationOrder.dosageInstruction[0].timing.repeat.period
        || !medicationOrder.dosageInstruction[0].timing.repeat.frequency
        || !medicationOrder.dosageInstruction[0].timing.repeat.boundsPeriod.start
        || !medicationOrder.dosageInstruction[0].doseQuantity.value
        || !medicationOrder.dosageInstruction[0].doseQuantity.unit
        || !medicationOrder.dispenseRequest.expectedSupplyDuration.value){
          if (medicationStatus == 'active') medicationStatus = 'expired';
          var html = 
          `
          <tr>
            <td>${medicationName}</td>
            <td>${medicationStatus}</td>
          </tr>
          `;
          $('#inactiveMedTable').append(html);
        } else {
          const startDate = new Date(medicationOrder.dosageInstruction[0].timing.repeat.boundsPeriod.start);
          const expectedSupplyDuration = medicationOrder.dispenseRequest.expectedSupplyDuration.value;
          const expirationDate = new Date(startDate.getTime() + expectedSupplyDuration * 24 * 60 * 60 * 1000);
          //display past medications
          var currentDate = new Date();

          if (expirationDate.getTime() < currentDate.getTime()) {
            medicationStatus = 'expired';
            var html = 
            `
            <tr>
              <td>${medicationName}</td>
              <td>${medicationStatus}</td>
            </tr>
            `;
            $('#inactiveMedTable').append(html);
          } else {
            var medicationQuantity = 
                        medicationOrder.dosageInstruction[0].doseQuantity.value 
                        + ' ' 
                        + medicationOrder.dosageInstruction[0].doseQuantity.unit.replace(/{|}/g, '');
            var medicationDirection = 
                        medicationOrder.dosageInstruction[0].timing.repeat.frequency
                        + ' time(s) per ' 
                        + medicationOrder.dosageInstruction[0].timing.repeat.period
                        + ' day(s)';
            var html = 
            `
              <tr>
                <td>${medicationName}</td>
                <td>${medicationQuantity}</td>
                <td>${medicationDirection}</td>
                <td>${expectedSupplyDuration + ' days'}</td>
                <td>${expirationDate.toDateString()}</td>
                <td><button type="button" class="btn btn btn-outline-danger" id="${medicationOrder.id}">Delete</button></td>
              </tr>
            `;
            $('#medicationTable').append(html);

            window.myCalendar.addEvent({
              title: medicationName + ' ' + medicationQuantity + ' ' + medicationDirection,
              start: medicationOrder.dosageInstruction[0].timing.repeat.boundsPeriod.start,
              end: addDays(medicationOrder.dosageInstruction[0].timing.repeat.boundsPeriod.start, expectedSupplyDuration),
              allDay: true,
            })
          }
        }
    });
  };
})(window);
