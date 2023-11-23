(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
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

          var p = defaultPatient();
          p.medicationOrders = med;
          p.birthdate = patient.birthDate;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;


          // Get list of prescribed medication
          med.forEach(function(medicationOrder) {
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
              console.log(interactingDrug);
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
      var startDate = new Date(medicationOrder.dosageInstruction[0].timing.repeat.boundsPeriod.start);
      var supplyDurationDays = medicationOrder.dispenseRequest.expectedSupplyDuration.value;
      
      // Add the supply duration to the start date to get the approximate expiration date
      var expirationDate = new Date(startDate.getTime() + supplyDurationDays * 24 * 60 * 60 * 1000);
      
      console.log(expirationDate);
      
      var medicationName = medicationOrder.medicationCodeableConcept.text;
      var medicationQuantity = medicationOrder.dispenseRequest.quantity.value + ' ' + medicationOrder.dispenseRequest.quantity.unit.replace(/{|}/g, '');
      var medicationDirection = medicationOrder.dosageInstruction[0].text;
      var medicationDuration = medicationOrder.dispenseRequest.expectedSupplyDuration.value + ' ' + medicationOrder.dispenseRequest.expectedSupplyDuration.unit.replace(/{|}/g, '');
      var html = `
        <tr>
          <td>${medicationName}</td>
          <td>${medicationQuantity}</td>
          <td>${medicationDirection}</td>
          <td>${medicationDuration}</td>
          </tr>
      `;
      $('#medicationTable').append(html);

      //display past medications
      var currentDate = new Date();
      if (expirationDate.getTime() < currentDate.getTime()) {
        var html = `
        <tr>
          <td>${medicationName}</td>
          <td>${expirationDate.toLocaleDateString()}</td>
        </tr>
      `;
      $('#pastMedTable').append(html);      } 


    });
  };

})(window);
