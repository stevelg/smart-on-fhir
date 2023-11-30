document.getElementById('search-form').addEventListener('submit', function(event) {
  event.preventDefault();
  var searchQuery = document.getElementById('search-input').value;
  searchMedication(searchQuery).then(displayResults);
});

function searchMedication(keyword) {
  return fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${keyword}`)
    .then(response => response.json())
    .then(data => data)
    .catch(error => console.error('Error:', error));
}

function displayResults(data) {
  if (data.drugGroup.conceptGroup) {
    var drugList = data.drugGroup.conceptGroup[1].conceptProperties;
    var resultList = document.getElementById('result-list');
    resultList.innerHTML = ''; // Clear previous results
    
    drugList.forEach(drug => {
      console.log(drug);
      var listItem = document.createElement('li');
      var addButton = document.createElement('button');
      addButton.setAttribute('type', 'button');
      addButton.setAttribute('class', 'btn btn-primary');
      addButton.setAttribute('data-bs-toggle', 'modal');
      addButton.setAttribute('data-bs-target', '#staticBackdrop');
      addButton.setAttribute('data-rxcui', drug.rxcui); // Store the rxcui as a data attribute on the button
      // addButton.setAttribute('data-patient-id', )

      listItem.textContent = drug.name;
      addButton.textContent = 'Add';
      
      // Add event listener to the button
      addButton.addEventListener('click', function() {
        var form = document.getElementById('medication-order-form');
        var rxcuiField = document.getElementById('rxcui-field'); // Get the hidden field
        form.drug.value = drug.name; // Populate the form with the drug information
        form.patientID.value = window.patientID;
        rxcuiField.value = this.getAttribute('data-rxcui'); // Store the rxcui in the hidden field
      });

      resultList.appendChild(listItem);
      resultList.appendChild(addButton);
    });
  } else {
    var resultList = document.getElementById('result-list');
    resultList.innerHTML = ''; // Clear previous results
    var listItem = document.createElement('li');
    listItem.textContent = 'No results found';
    resultList.appendChild(listItem);
  }
}

var form = document.getElementById('medication-order-form');
// var submitButton = document.getElementById('modal-submit-button');

// submitButton.addEventListener('click', function(event) {
//   event.preventDefault(); // Prevent the button from submitting the form normally

//   // Trigger the form submission
//   form.dispatchEvent(new Event('submit'));
// });

form.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent the form from submitting normally

  var formData = new FormData(form);

  var patientId = window.patientID;
  var rxcui = formData.get('rxcui');
  var drugName = formData.get('drug');
  var startDate = formData.get('start-date');
  var dispenseQuantity = formData.get('dispense-quantity');
  var frequency = formData.get('frequency');
  var period = formData.get('period');
  var doseQuantity = formData.get('dose-quantity');
  var doseUnit = formData.get('dose-unit');

  var medicationOrder = {
    "resourceType": "MedicationOrder",
    "status": "active",
    "patient": {
        "reference": "Patient/" + patientId,
    },
    "medicationCodeableConcept": {
        "coding": [
            {
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": rxcui,
                "display": drugName,
            }
        ],
        "text": drugName,
    },
    "dosageInstruction": [
        {
            // "text": "1 daily",
            "timing": {
                "repeat": {
                    "boundsPeriod": {
                        "start": startDate
                    },
                    "frequency": frequency,
                    "period": period,
                    "periodUnits": "d"
                }
            },
            "doseQuantity": {
                "value": doseQuantity,
                "unit": doseUnit,
                "system": "http://unitsofmeasure.org",
                "code": doseUnit
            }
        }
    ],
    "dispenseRequest": {
        "quantity": {
            "value": dispenseQuantity,
            "unit": doseUnit,
            "system": "http://unitsofmeasure.org",
            "code": doseUnit
        },
        "expectedSupplyDuration": {
            "value": Math.floor(dispenseQuantity / (doseQuantity * (frequency / period))),
            "unit": "days",
            "system": "http://unitsofmeasure.org",
            "code": "d"
        }
    }
  }
  
  console.log(medicationOrder);

  // Submit the medication order
  smartClient.patient.api.create({
    resource: medicationOrder,
  }).then(function(response) {
    // The medication order was successfully created
    console.log('Medication order created:', response);
    // Switch to the active medication tab
    setTimeout(function(){ 
      document.getElementById('med-tab').click();
      // location.reload();
    }, 1000);
    // location.reload();
  }, function(error) {
    // An error occurred
    console.error('Error creating medication order:', error);
  });

  // Close the modal after successful submission
  var myModal = bootstrap.Modal.getInstance(document.getElementById('staticBackdrop'));
  myModal.hide();
});